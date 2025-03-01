import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
import time
import os
import re
import csv
from urllib.parse import urljoin
import random

def get_random_headers():
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
    }

def make_request(url, retries=3):
    """Make a request with retry logic."""
    for _ in range(retries):
        try:
            headers = get_random_headers()
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response
            time.sleep(2)
        except Exception as e:
            print(f"Error making request to {url}: {str(e)}")
            time.sleep(2)
    return None

def clean_filename(text):
    """Create a clean filename from text."""
    # Remove non-alphanumeric characters except spaces and hyphens
    clean = re.sub(r'[^\w\s-]', '', text)
    # Replace spaces with underscores
    clean = clean.replace(' ', '_')
    # Remove consecutive underscores
    clean = re.sub(r'_+', '_', clean)
    return clean.strip('_')

def extract_ebook_id(url):
    """Extract the ebook ID from a Project Gutenberg URL."""
    match = re.search(r'/ebooks/(\d+)', url)
    return match.group(1) if match else None

def get_metadata(book_url):
    """Extract metadata from a Project Gutenberg book page."""
    try:
        response = make_request(book_url)
        if not response:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Get title and author from the bibrec table
        bibrec = soup.find('table', {'class': 'bibrec'})
        title = "Unknown"
        author = "Unknown"
        year = "Unknown"
        
        if bibrec:
            # Find title
            title_row = bibrec.find('th', string=re.compile('^Title$', re.I))
            if title_row:
                title = title_row.find_next_sibling('td').text.strip()
            
            # Find author
            author_row = bibrec.find('th', string=re.compile('^Author$', re.I))
            if author_row:
                author = author_row.find_next_sibling('td').text.strip()
                # Clean up author name
                author = re.sub(r'\d+[-–]\d+', '', author)  # Remove life span years
                author = re.sub(r'\([^)]*\)', '', author)   # Remove parenthetical info
                author = author.strip(' .,')
            
            # Find publication year
            release_row = bibrec.find('th', string=re.compile('Release Date|Publication date', re.I))
            if release_row:
                year_text = release_row.find_next_sibling('td').text
                year_match = re.search(r'\d{4}', year_text)
                if year_match:
                    year = year_match.group(0)
        
        # If we couldn't find the title and author in bibrec, try the h1 header
        if title == "Unknown" or author == "Unknown":
            h1 = soup.find('h1', {'class': 'header'})
            if h1:
                h1_text = h1.text.strip()
                if ' by ' in h1_text:
                    title, author = h1_text.split(' by ', 1)
                    title = title.strip()
                    author = author.strip()
        
        # Get the ebook ID
        ebook_id = extract_ebook_id(book_url)
        if not ebook_id:
            return None
            
        # Construct the direct text download URL
        text_url = f"https://www.gutenberg.org/files/{ebook_id}/{ebook_id}-0.txt"
        
        # If that doesn't work, try alternative URLs
        if make_request(text_url) is None:
            text_url = f"https://www.gutenberg.org/files/{ebook_id}/{ebook_id}.txt"
            if make_request(text_url) is None:
                text_url = f"https://www.gutenberg.org/cache/epub/{ebook_id}/pg{ebook_id}.txt"
                if make_request(text_url) is None:
                    return None
        
        return {
            'title': title,
            'author': author,
            'year': year,
            'text_url': text_url,
            'gutenberg_url': book_url,
            'ebook_id': ebook_id
        }
    except Exception as e:
        print(f"Error processing {book_url}: {str(e)}")
        return None

def download_book(text_url, output_path):
    """Download a book's text content."""
    try:
        response = make_request(text_url)
        if not response:
            return False
            
        # Save the raw content
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        return True
    except Exception as e:
        print(f"Error downloading {text_url}: {str(e)}")
        return False

def get_top_books_list(url):
    """Get list of top books from Project Gutenberg."""
    response = make_request(url)
    if not response:
        return []
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find the ordered list containing the top books
    book_list = soup.find('ol')
    if not book_list:
        return []
    
    # Extract book links from the ordered list
    book_links = []
    for item in book_list.find_all('li'):
        link = item.find('a')
        if link and link.get('href', '').startswith('/ebooks/'):
            href = link.get('href')
            if not href.endswith('.zip'):  # Skip zip files
                full_url = urljoin(url, href)
                book_links.append(full_url)
    
    return book_links

def main():
    # Create necessary directories
    if not os.path.exists('books'):
        os.makedirs('books')
    
    # Base URL for Project Gutenberg's top books
    base_url = "https://www.gutenberg.org/browse/scores/top"
    
    print("Fetching list of top books...")
    book_links = get_top_books_list(base_url)
    
    if not book_links:
        print("Failed to fetch the book list. Please try again later.")
        return
    
    # Read existing metadata first
    existing_metadata = []
    try:
        with open('book_metadata.csv', 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            existing_metadata = list(reader)
    except FileNotFoundError:
        pass
    
    # Get set of existing ebook IDs
    existing_ids = {book['ebook_id'] for book in existing_metadata}
    
    # Get list of book links
    book_links = get_top_books_list(base_url)
    book_links = list(set(book_links))[25:55]  # Get next 30 unique books after first 25
    
    metadata_list = []
    for link in book_links:
        try:
            metadata = get_metadata(link)
            if metadata and metadata['ebook_id'] not in existing_ids:
                metadata_list.append(metadata)
                existing_ids.add(metadata['ebook_id'])
                print(f"Downloaded: {metadata['title']} by {metadata['author']}")
        except Exception as e:
            print(f"Error processing {link}: {str(e)}")
            continue

    print(f"\nSuccessfully downloaded {len(metadata_list)} new books")
    
    # Combine existing and new metadata, ensuring no duplicates
    all_metadata = existing_metadata + metadata_list
    
    # Remove duplicates based on ebook_id while preserving order
    seen_ids = set()
    unique_metadata = []
    for book in all_metadata:
        if book['ebook_id'] not in seen_ids:
            unique_metadata.append(book)
            seen_ids.add(book['ebook_id'])
    
    # Save all metadata to CSV
    if unique_metadata:
        with open('book_metadata.csv', 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['title', 'author', 'year', 'filename', 'gutenberg_url', 'text_url', 'ebook_id']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(unique_metadata)
            print(f"Metadata saved to book_metadata.csv")
    else:
        print("\nNo books were downloaded successfully.")

if __name__ == "__main__":
    main() 