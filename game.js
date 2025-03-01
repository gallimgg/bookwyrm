// Available books
const books = [
    'SimpleSabotageFieldManual_OfficeOfStrategicServices.txt',
    'Ulysses_JamesJoyce.txt',
    'Middlemarch_GeorgeEliot.txt',
    'A_Study_in_Scarlet_Doyle_Arthur_Conan.txt',
    'Romeo_and_Juliet_Shakespeare_William.txt',
    'The_Scarlet_Letter_Hawthorne_Nathaniel.txt',
    'The_Blue_Castle_a_novel_Montgomery_L_M.txt',
    'Wuthering_Heights_Brontë_Emily.txt',
    'The_Iliad_Homer_751_BCE-651_BCE.txt',
    'Beowulf_An_Anglo-Saxon_Epic_Poem_Unknown.txt'
];

// Current book information
let currentBook = {
    title: '',
    author: '',
    filename: ''
};

// Global variables for game state
let arrowsUsed = 0;
let currentPassages = [];
let metadata = null;
let titleChoiceShown = false;
let authorChoiceShown = false;
let isDailyMode = true;  // Set daily mode as default
let dailyPassages = null;

// Function to parse book information from filename
function parseBookInfo(filename) {
    // Remove .txt extension
    const withoutExt = filename.replace('.txt', '');
    
    // Split on last underscore to separate author
    const lastUnderscoreIndex = withoutExt.lastIndexOf('_');
    const titlePart = withoutExt.substring(0, lastUnderscoreIndex);
    let authorPart = withoutExt.substring(lastUnderscoreIndex + 1);
    
    // Convert underscore to spaces for title
    const title = titlePart.replace(/_/g, ' ');
    
    // Handle author name with special cases
    authorPart = authorPart.replace(/_/g, ' ');
    
    // Clean up author name
    authorPart = authorPart
        .replace(/\d+\s*[-–]?\s*\d*\s*BCE/, 'Homer')  // Fix Homer's date
        .replace(/\s+BCE.*$/, '')  // Remove any remaining BCE references
        .replace(/^\s*(\d+|Unknown)$/, 'Unknown');  // Replace numeric-only or "Unknown" authors
    
    if (authorPart.includes(',')) {
        // Handle comma-separated names (e.g., "Doyle, Arthur Conan")
        const parts = authorPart.split(',').map(part => part.trim());
        if (parts.length === 2) {
            // Standard Last, First format
            authorPart = `${parts[1]} ${parts[0]}`;
        } else {
            // Keep original format for complex cases
            authorPart = parts.join(' ').trim();
        }
    }
    
    // Clean up any extra spaces
    authorPart = authorPart.replace(/\s+/g, ' ').trim();
    
    return { 
        title: title.trim(), 
        author: authorPart,
        filename
    };
}

// Function to get exactly 100 words from text
function getHundredWordSelection(text) {
    // Split into words, keeping punctuation attached to words
    const allWords = text.split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0); // Keep all non-empty words
    
    if (allWords.length < 100) {
        console.log('Warning: Text has fewer than 100 words:', allWords.length);
        return null;  // Signal that we need more text
    }
    
    // Get a random starting point that leaves room for 100 words
    const maxStart = Math.max(0, allWords.length - 100);
    let start = Math.floor(Math.random() * maxStart);
    
    // Get exactly 100 words
    let selection = allWords.slice(start, start + 100);
    
    // Join with proper spacing and verify
    let result = selection.join(' ');
    const finalCount = result.split(/\s+/).filter(w => w.length > 0).length;
    
    console.log('Final word count:', finalCount);
    
    if (finalCount !== 100) {
        // Emergency fallback: take exactly 100 words without any fancy logic
        result = allWords.slice(start, start + 100).join(' ');
    }
    
    return result;
}

// Function to select a random book
function selectRandomBook() {
    const randomBook = books[Math.floor(Math.random() * books.length)];
    currentBook = parseBookInfo(randomBook);
    return currentBook;
}

// Function to load and parse the metadata CSV
async function loadMetadata() {
    try {
        const response = await fetch('book_metadata.csv');
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');
        
        metadata = lines.slice(1).map(line => {
            // Handle CSV properly, accounting for quoted values
            let values = [];
            let currentValue = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue.trim());
            
            const obj = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = values[i] ? values[i].replace(/^"|"$/g, '') : '';
            });
            return obj;
        });
        
        // Update books array with filenames from metadata
        books.length = 0;
        books.push(...metadata.map(book => book.filename).filter(Boolean));
        console.log('Loaded books:', books);
    } catch (error) {
        console.error('Error loading metadata:', error);
    }
}

// Function to generate multiple choice options
function generateMultipleChoice() {
    if (isDailyMode) {
        if (!dailyPassages) return null;
        
        const todaysPassage = getTodaysPassage();
        if (!todaysPassage) return null;

        const options = {
            titles: [todaysPassage.book],
            authors: [todaysPassage.author]
        };

        // Get 3 random different titles and authors from daily passages
        while (options.titles.length < 4) {
            const randomPassage = dailyPassages.passages[Math.floor(Math.random() * dailyPassages.passages.length)];
            if (!options.titles.includes(randomPassage.book)) {
                options.titles.push(randomPassage.book);
            }
        }

        while (options.authors.length < 4) {
            const randomPassage = dailyPassages.passages[Math.floor(Math.random() * dailyPassages.passages.length)];
            if (!options.authors.includes(randomPassage.author)) {
                options.authors.push(randomPassage.author);
            }
        }

        // Shuffle arrays
        options.titles = options.titles.sort(() => Math.random() - 0.5);
        options.authors = options.authors.sort(() => Math.random() - 0.5);

        return options;
    } else {
        // Original free play mode code
        if (!metadata) return null;
        
        const options = {
            titles: [metadata.find(book => book.filename === currentBook.filename)?.title || currentBook.title],
            authors: [metadata.find(book => book.filename === currentBook.filename)?.author || currentBook.author]
        };
        
        // Get 3 random different titles and authors from metadata
        while (options.titles.length < 4) {
            const randomBook = metadata[Math.floor(Math.random() * metadata.length)];
            if (!options.titles.includes(randomBook.title)) {
                options.titles.push(randomBook.title);
            }
        }
        
        while (options.authors.length < 4) {
            const randomBook = metadata[Math.floor(Math.random() * metadata.length)];
            if (!options.authors.includes(randomBook.author)) {
                options.authors.push(randomBook.author);
            }
        }
        
        // Shuffle arrays
        options.titles = options.titles.sort(() => Math.random() - 0.5);
        options.authors = options.authors.sort(() => Math.random() - 0.5);
        
        return options;
    }
}

// Function to show multiple choice options for either title or author
function showMultipleChoice(type) {
    const options = generateMultipleChoice();
    if (!options) return;
    
    const list = document.getElementById(`${type}Options`);
    const choices = type === 'title' ? options.titles : options.authors;
    
    if (list) {
        list.innerHTML = choices.map((choice) => 
            `<button onclick="selectOption('${type}', '${choice.replace(/'/g, "\\'")}')">${choice}</button>`
        ).join('');
        list.style.display = 'grid';
    }
}

// Function to handle option selection
function selectOption(type, value) {
    const input = document.getElementById(type === 'title' ? 'titleInput' : 'authorInput');
    input.value = value;
}

// Function to request more text or show multiple choice
async function requestMoreText(type) {
    arrowsUsed++;
    document.getElementById('arrowsUsed').textContent = `Arrows Used: ${arrowsUsed}`;
    
    if (type === 'title') {
        titleChoiceShown = true;
        showMultipleChoice('title');
    } else if (type === 'author') {
        authorChoiceShown = true;
        showMultipleChoice('author');
    } else if (type === 'text' && paragraphs && paragraphs.length > 0) {
        // Get a new random selection of 100 words
        const randomStart = Math.floor(Math.random() * (paragraphs.length - 100));
        const newPassage = paragraphs.slice(randomStart, randomStart + 100).join(' ');
        
        // Add the new passage with a separator
        const bookPassage = document.getElementById('bookPassage');
        if (bookPassage.textContent) {
            bookPassage.textContent += '\n\n...\n\n';
        }
        bookPassage.textContent += newPassage;
        
        // Update word count
        const wordCount = newPassage.split(/\s+/).filter(word => word.length > 0).length;
        document.getElementById('wordCount').textContent = `[${wordCount} words]`;
    }
}

// Function to get today's passage index based on date
function getDailyPassageIndex() {
    const today = new Date();
    const startDate = new Date(2024, 0, 1); // January 1, 2024
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    return daysSinceStart;
}

// Function to load daily passages
async function loadDailyPassages() {
    try {
        const response = await fetch('famous_passages.json');
        dailyPassages = await response.json();
    } catch (error) {
        console.error('Error loading daily passages:', error);
        return null;
    }
}

// Function to get today's passage
function getTodaysPassage() {
    if (!dailyPassages) return null;
    const index = getDailyPassageIndex() % dailyPassages.passages.length;
    return dailyPassages.passages[index];
}

// Modified loadRandomPassage function
async function loadRandomPassage() {
    try {
        if (isDailyMode) {
            if (!dailyPassages) {
                await loadDailyPassages();
            }
            const todaysPassage = getTodaysPassage();
            if (!todaysPassage) {
                throw new Error('Could not load daily passage');
            }

            // Set current book info
            currentBook = {
                title: todaysPassage.book,
                author: todaysPassage.author,
                filename: null
            };

            // Display the passage
            const bookPassage = document.getElementById('bookPassage');
            bookPassage.textContent = todaysPassage.text;
            
            // Update word count
            const wordCount = todaysPassage.text.split(/\s+/).filter(word => word.length > 0).length;
            document.getElementById('wordCount').textContent = `[${wordCount} words]`;

            // Reset game state
            arrowsUsed = 0;
            titleChoiceShown = false;
            authorChoiceShown = false;
            document.getElementById('arrowsUsed').textContent = `Arrows Used: ${arrowsUsed}`;

            return;
        }

        // Original free play mode code
        // Load metadata if not loaded
        if (!metadata) {
            await loadMetadata();
        }
        
        // Reset game state
        arrowsUsed = 0;
        titleChoiceShown = false;
        authorChoiceShown = false;
        document.getElementById('arrowsUsed').textContent = `Arrows Used: ${arrowsUsed}`;
        document.getElementById('titleOptions').style.display = 'none';
        document.getElementById('authorOptions').style.display = 'none';
        
        // Select a random book
        const book = selectRandomBook();
        console.log('Selected book:', book);

        // Fetch the book content
        const response = await fetch(`books/${book.filename}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        
        if (!text || text.length < 100) {
            throw new Error(`Book file is empty or too short (length: ${text.length})`);
        }

        // Remove Project Gutenberg header and footer
        let cleanText = text;
        const startMarker = '*** START OF';
        const endMarker = '*** END OF';
        const startIndex = text.indexOf(startMarker);
        const endIndex = text.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
            cleanText = text.substring(startIndex + startMarker.length, endIndex);
        }
        
        // Normalize line endings and split into paragraphs
        const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Instead of looking for paragraphs, just split into words and filter out empty lines
        const allWords = normalizedText.split(/\s+/)
            .map(word => word.trim())
            .filter(word => word.length > 0)
            .filter(word => {
                const skipPatterns = [
                    /^CHAPTER [IVXLC]+\.?$/i,
                    /^BOOK [IVXLC]+\.?/i,
                    /^PRELUDE/i,
                    /^FINALE/i,
                    /^Contents/i,
                    /Project Gutenberg/i,
                    /^\s*\[.*\]\s*$/,
                    /^\s*—.*—\s*$/,
                    /^\s*\d+\s*$/
                ];
                return !skipPatterns.some(pattern => pattern.test(word));
            });
        
        if (allWords.length < 100) {
            throw new Error('Text has fewer than 100 words');
        }
        
        // Get initial passage
        const randomStart = Math.floor(Math.random() * (allWords.length - 100));
        const initialPassage = allWords.slice(randomStart, randomStart + 100).join(' ');
        
        // Display the passage
        document.getElementById('bookPassage').textContent = initialPassage;
        
        // Update word count
        const wordCount = initialPassage.split(/\s+/).filter(word => word.length > 0).length;
        document.getElementById('wordCount').textContent = `[${wordCount} words]`;
        
        // Store words globally for later use
        window.paragraphs = allWords;
        
    } catch (error) {
        console.error('Error details:', error);
        console.error('Failed book:', currentBook);
        document.getElementById('bookPassage').textContent = 
            'Error loading passage: ' + error.message;
    }
}

// Function to normalize text for comparison
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Function to check if strings match using fuzzy logic
function fuzzyMatch(guess, actual) {
    // Normalize both strings
    const normalizedGuess = normalizeText(guess);
    const normalizedActual = normalizeText(actual);
    
    // Direct match after normalization
    if (normalizedGuess === normalizedActual) return true;
    
    // Check if guess is a substring of actual (for titles)
    if (normalizedActual.includes(normalizedGuess)) return true;
    
    // For author names, handle various formats
    if (normalizedActual.includes(',')) {  // If actual has format "Last, First"
        const [last, first] = normalizedActual.split(',').map(s => s.trim());
        const variations = [
            `${first} ${last}`,           // First Last
            `${last}`,                    // Last only
            `${first[0]} ${last}`,        // F Last
            `${first[0]}. ${last}`,       // F. Last
        ].map(v => normalizeText(v));
        
        if (variations.some(v => v === normalizedGuess)) return true;
    }
    
    // Calculate similarity for typo tolerance
    const maxLength = Math.max(normalizedGuess.length, normalizedActual.length);
    const distance = levenshteinDistance(normalizedGuess, normalizedActual);
    const similarity = (maxLength - distance) / maxLength;
    
    // Return true if similarity is above threshold
    return similarity > 0.8;  // 80% similarity threshold
}

// Levenshtein distance calculation for fuzzy matching
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i-1] === str2[j-1]) {
                dp[i][j] = dp[i-1][j-1];
            } else {
                dp[i][j] = Math.min(
                    dp[i-1][j-1] + 1,  // substitution
                    dp[i-1][j] + 1,    // deletion
                    dp[i][j-1] + 1     // insertion
                );
            }
        }
    }
    
    return dp[m][n];
}

// Modify the checkGuess function
function checkGuess() {
    const titleGuess = document.getElementById('titleInput').value.trim();
    const authorGuess = document.getElementById('authorInput').value.trim();
    const result = document.getElementById('result');
    
    if (isDailyMode) {
        const todaysPassage = getTodaysPassage();
        if (!todaysPassage) {
            console.error('Could not get today\'s passage');
            return;
        }
        
        const titleCorrect = fuzzyMatch(titleGuess, todaysPassage.book);
        const authorCorrect = fuzzyMatch(authorGuess, todaysPassage.author);
        
        if (titleCorrect && authorCorrect) {
            result.textContent = `CORRECT! This passage was from "${todaysPassage.book}" by ${todaysPassage.author}`;
            result.style.color = '#00ff00';
            localStorage.setItem('arrowsUsed', arrowsUsed);
            // Store book info for winner page
            localStorage.setItem('winningBookTitle', todaysPassage.book);
            localStorage.setItem('winningBookAuthor', todaysPassage.author);
            localStorage.setItem('winningBookUrl', ''); // No URL for daily passages
            setTimeout(() => {
                window.location.href = 'winner.html';
            }, 2000);
        } else {
            let message = "INCORRECT. ";
            if (!titleCorrect && !authorCorrect) message += "Both title and author are wrong.";
            else if (!titleCorrect) message += "The title is wrong.";
            else message += "The author is wrong.";
            
            result.textContent = message;
            result.classList.add('blink');
            setTimeout(() => {
                result.classList.remove('blink');
            }, 2000);
        }
        return;
    }
    
    // Original free play mode code
    // Get the correct values from metadata
    const correctBook = metadata.find(book => book.filename === currentBook.filename);
    if (!correctBook) {
        console.error('Could not find book in metadata:', currentBook);
        return;
    }
    
    const titleCorrect = fuzzyMatch(titleGuess, correctBook.title);
    const authorCorrect = fuzzyMatch(authorGuess, correctBook.author);
    
    if (titleCorrect && authorCorrect) {
        result.textContent = `CORRECT! This passage was from "${correctBook.title}" by ${correctBook.author}`;
        result.style.color = '#00ff00';
        localStorage.setItem('arrowsUsed', arrowsUsed);
        // Store book info for winner page
        localStorage.setItem('winningBookTitle', correctBook.title);
        localStorage.setItem('winningBookAuthor', correctBook.author);
        localStorage.setItem('winningBookUrl', correctBook.gutenberg_url);
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 2000);
    } else {
        let message = "INCORRECT. ";
        if (!titleCorrect && !authorCorrect) message += "Both title and author are wrong.";
        else if (!titleCorrect) message += "The title is wrong.";
        else message += "The author is wrong.";
        
        result.textContent = message;
        result.classList.add('blink');
        setTimeout(() => {
            result.classList.remove('blink');
        }, 2000);
    }
}

// Handle Enter key for both input fields
document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['titleInput', 'authorInput'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (id === 'titleInput') {
                    document.getElementById('authorInput').focus();
                } else {
                    checkGuess();
                }
            }
        });
    });
});

// Load a random passage when the page loads
window.addEventListener('load', () => {
    // Initialize daily mode
    setGameMode('daily');
});

// Export functions for use in HTML
window.checkGuess = checkGuess;
window.requestMoreText = requestMoreText;
window.selectOption = selectOption;

function setGameMode(mode) {
    isDailyMode = mode === 'daily';
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide daily info
    document.getElementById('dailyInfo').style.display = isDailyMode ? 'block' : 'none';
    
    // Disable/enable the Get More Text button in daily mode
    document.getElementById('moreTextBtn').disabled = isDailyMode;
    
    if (isDailyMode) {
        updateNextChallengeTime();
        // Start the timer update
        setInterval(updateNextChallengeTime, 1000);
    }
    
    // Load new passage
    loadRandomPassage();
} 