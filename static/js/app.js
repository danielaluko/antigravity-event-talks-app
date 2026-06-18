// State management
let allReleases = [];
let filteredReleases = [];
let activeFilter = 'all';
let searchQuery = '';
let selectedUpdateId = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshSpinner = document.getElementById('refresh-spinner');
const lastUpdatedText = document.getElementById('last-updated-text');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterTagsList = document.getElementById('filter-tags-list');
const releasesFeed = document.getElementById('releases-feed');
const loadingState = document.getElementById('feed-loading-state');
const errorState = document.getElementById('feed-error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('feed-empty-state');
const retryBtn = document.getElementById('retry-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Stats Counters
const countTotal = document.getElementById('count-total');
const countFeatures = document.getElementById('count-features');
const countAnnouncements = document.getElementById('count-announcements');
const countDeprecations = document.getElementById('count-deprecations');

// Tweet Composer Elements
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const charProgressCircle = document.getElementById('char-progress-circle');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const publishTweetBtn = document.getElementById('publish-tweet-btn');
const selectionBanner = document.getElementById('selection-banner');
const selectionTypeBadge = document.getElementById('selection-type-badge');
const selectionDateText = document.getElementById('selection-date-text');
const clearSelectionBtn = document.getElementById('clear-selection-btn');

// Toast Notification Manager
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Smooth remove after 3s
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// Utility: Strip HTML tags to get clean text preview
function stripHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove headers if present in text extraction
    const headers = tempDiv.querySelectorAll('h3');
    headers.forEach(h => h.remove());
    
    return tempDiv.textContent || tempDiv.innerText || "";
}

// Fetch releases from local Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    toggleLoading(true);
    refreshBtn.disabled = true;
    refreshSpinner.classList.add('spinning');
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch release notes.');
        }
        
        allReleases = data.releases;
        lastUpdatedText.textContent = `Synced: ${data.last_fetched}`;
        
        // Setup stats bar
        updateStats();
        
        // Filter and render
        applyFiltersAndSearch();
        
        if (data.error) {
            showToast(data.error, 'error');
        } else if (forceRefresh) {
            showToast('Release notes updated successfully!', 'success');
        }
        
    } catch (error) {
        console.error(error);
        showError(error.message);
    } finally {
        toggleLoading(false);
        refreshBtn.disabled = false;
        refreshSpinner.classList.remove('spinning');
    }
}

// Update Summary Panel Stats
function updateStats() {
    let totalNotes = 0;
    let featuresCount = 0;
    let announcementsCount = 0;
    let deprecationsCount = 0;
    
    allReleases.forEach(entry => {
        entry.sections.forEach(sec => {
            totalNotes++;
            const type = sec.type.toLowerCase();
            if (type.includes('feature')) featuresCount++;
            else if (type.includes('announcement')) announcementsCount++;
            else if (type.includes('deprecat')) deprecationsCount++;
        });
    });
    
    countTotal.textContent = totalNotes;
    countFeatures.textContent = featuresCount;
    countAnnouncements.textContent = announcementsCount;
    countDeprecations.textContent = deprecationsCount;
}

// State UI toggles
function toggleLoading(isLoading) {
    loadingState.style.display = isLoading ? 'flex' : 'none';
    if (isLoading) {
        releasesFeed.style.display = 'none';
        errorState.style.display = 'none';
        emptyState.style.display = 'none';
    }
}

function showError(msg) {
    errorState.style.display = 'flex';
    errorMessage.textContent = msg;
    releasesFeed.style.display = 'none';
    loadingState.style.display = 'none';
    emptyState.style.display = 'none';
    showToast('Failed to connect to feed service', 'error');
}

// Apply Active Tag and Search queries
function applyFiltersAndSearch() {
    filteredReleases = [];
    
    allReleases.forEach(entry => {
        // Deep copy entry to avoid mutating global array
        const matchedSections = [];
        
        entry.sections.forEach(sec => {
            // Check Tag Filter match
            const type = sec.type.toLowerCase();
            let matchesTag = false;
            
            if (activeFilter === 'all') {
                matchesTag = true;
            } else if (activeFilter === 'feature' && type.includes('feature')) {
                matchesTag = true;
            } else if (activeFilter === 'announcement' && type.includes('announcement')) {
                matchesTag = true;
            } else if (activeFilter === 'deprecation' && type.includes('deprecat')) {
                matchesTag = true;
            } else if (activeFilter === 'other' && !type.includes('feature') && !type.includes('announcement') && !type.includes('deprecat')) {
                matchesTag = true;
            }
            
            if (!matchesTag) return;
            
            // Check Search Query match
            if (searchQuery) {
                const cleanBody = stripHtml(sec.body).toLowerCase();
                const cleanType = sec.type.toLowerCase();
                const cleanDate = entry.date_str.toLowerCase();
                const q = searchQuery.toLowerCase();
                
                if (cleanBody.includes(q) || cleanType.includes(q) || cleanDate.includes(q)) {
                    matchedSections.push(sec);
                }
            } else {
                matchedSections.push(sec);
            }
        });
        
        if (matchedSections.length > 0) {
            filteredReleases.push({
                ...entry,
                sections: matchedSections
            });
        }
    });
    
    renderFeed();
}

// Highlight matching search text
function highlightText(text, search) {
    if (!search) return text;
    // Basic regex replacement for highlighting search term, ignoring HTML tags
    try {
        const regex = new RegExp(`(${escapeRegExp(search)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    } catch (e) {
        return text;
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Render dynamic Feed Cards
function renderFeed() {
    releasesFeed.innerHTML = '';
    
    if (filteredReleases.length === 0) {
        releasesFeed.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    releasesFeed.style.display = 'flex';
    emptyState.style.display = 'none';
    
    filteredReleases.forEach(entry => {
        const dayGroup = document.createElement('article');
        dayGroup.className = 'day-group';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        
        // Format Date beautifully
        dayHeader.innerHTML = `
            <h2 class="day-title">${highlightText(entry.date_str, searchQuery)}</h2>
            <span class="day-badge">${entry.sections.length} ${entry.sections.length === 1 ? 'update' : 'updates'}</span>
        `;
        
        const daySections = document.createElement('div');
        daySections.className = 'day-sections';
        
        entry.sections.forEach((sec, idx) => {
            const secId = `${entry.id}_section_${idx}`;
            const isSelected = selectedUpdateId === secId;
            
            const updateSec = document.createElement('div');
            updateSec.className = `update-section ${isSelected ? 'selected' : ''}`;
            updateSec.id = secId;
            
            // Map Type to appropriate CSS badge class
            const typeLower = sec.type.toLowerCase();
            let badgeClass = 'badge-other';
            let iconClass = 'fa-circle-info';
            
            if (typeLower.includes('feature')) {
                badgeClass = 'badge-feature';
                iconClass = 'fa-solid fa-star';
            } else if (typeLower.includes('announcement')) {
                badgeClass = 'badge-announcement';
                iconClass = 'fa-solid fa-bullhorn';
            } else if (typeLower.includes('deprecat')) {
                badgeClass = 'badge-deprecation';
                iconClass = 'fa-solid fa-triangle-exclamation';
            }
            
            // Setup Section Content
            updateSec.innerHTML = `
                <div class="section-meta">
                    <span class="badge ${badgeClass}"><i class="${iconClass}"></i> ${highlightText(sec.type, searchQuery)}</span>
                    <div class="section-actions">
                        <button class="btn-card-action btn-card-tweet" title="Tweet this specific update" onclick="selectUpdateForTweet('${entry.date_str}', '${sec.type}', \`${escapeHtml(sec.body)}\`, '${entry.link}', '${secId}', event)">
                            <i class="fa-brands fa-x-twitter"></i> Select to Tweet
                        </button>
                    </div>
                </div>
                <div class="release-content">
                    ${highlightText(sec.body, searchQuery)}
                </div>
            `;
            
            // Handle clicking anywhere on the card to select it for Tweet
            updateSec.addEventListener('click', () => {
                selectUpdateForTweet(entry.date_str, sec.type, sec.body, entry.link, secId);
            });
            
            daySections.appendChild(updateSec);
        });
        
        dayGroup.appendChild(dayHeader);
        dayGroup.appendChild(daySections);
        releasesFeed.appendChild(dayGroup);
    });
    
    // Add target="_blank" to all links in feed content
    document.querySelectorAll('.release-content a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
}

// Simple HTML escaping helper for code attributes
function escapeHtml(html) {
    return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Tweet Composer Management
function selectUpdateForTweet(dateStr, type, bodyHtml, link, secId, event) {
    if (event) {
        event.stopPropagation(); // Stop parent trigger
    }
    
    selectedUpdateId = secId;
    
    // Highlight active card
    document.querySelectorAll('.update-section').forEach(card => {
        card.classList.remove('selected');
    });
    const activeCard = document.getElementById(secId);
    if (activeCard) activeCard.classList.add('selected');
    
    // Clean text and build draft
    const cleanText = stripHtml(bodyHtml).replace(/\s+/g, ' ').trim();
    
    // Compose Twitter limits: Twitter URL is counted as exactly 23 chars
    const maxChars = 280;
    const prefix = `📢 BigQuery Update (${dateStr}) - [${type}]: `;
    const suffix = `\n\nNotes: ${link}`;
    
    // Exact reserved spaces
    const linkLength = 23;
    const reservedSpace = prefix.length + 2 + linkLength; // 2 newlines
    const allowedBodySpace = maxChars - reservedSpace;
    
    let tweetBodyText = cleanText;
    if (tweetBodyText.length > allowedBodySpace) {
        tweetBodyText = tweetBodyText.substring(0, allowedBodySpace - 3) + "...";
    }
    
    const draftTweet = `${prefix}${tweetBodyText}${suffix}`;
    
    // Set into composer
    tweetTextarea.value = draftTweet;
    updateTweetStats();
    
    // Show active selection banner
    selectionTypeBadge.textContent = type;
    
    // Clear previous color class
    selectionTypeBadge.className = 'selection-badge';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('feature')) selectionTypeBadge.classList.add('badge-feature');
    else if (typeLower.includes('announcement')) selectionTypeBadge.classList.add('badge-announcement');
    else if (typeLower.includes('deprecat')) selectionTypeBadge.classList.add('badge-deprecation');
    else selectionTypeBadge.classList.add('badge-other');
    
    selectionDateText.textContent = dateStr;
    selectionBanner.style.display = 'flex';
    
    // Scroll composer to view on mobile
    if (window.innerWidth <= 1024) {
        document.querySelector('.social-column').scrollIntoView({ behavior: 'smooth' });
    }
    
    showToast('Loaded update into X/Twitter Composer', 'info');
}

function updateTweetStats() {
    const text = tweetTextarea.value;
    
    // Simulate real Twitter link length rules
    let currentLength = text.length;
    
    // Find all links in the text and substitute length calculation with 23 characters
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    
    urls.forEach(url => {
        currentLength = currentLength - url.length + 23;
    });
    
    const remaining = 280 - currentLength;
    charCounter.textContent = remaining;
    
    // UI Feedback for limits
    if (remaining < 0) {
        charCounter.style.color = 'var(--color-deprecation)';
        publishTweetBtn.classList.add('disabled');
        publishTweetBtn.removeAttribute('href');
    } else {
        charCounter.style.color = remaining <= 20 ? 'hsl(45, 100%, 50%)' : 'var(--color-text-secondary)';
        
        if (text.trim().length > 0) {
            publishTweetBtn.classList.remove('disabled');
            const encodedText = encodeURIComponent(text);
            publishTweetBtn.setAttribute('href', `https://twitter.com/intent/tweet?text=${encodedText}`);
        } else {
            publishTweetBtn.classList.add('disabled');
            publishTweetBtn.removeAttribute('href');
        }
    }
    
    // Update SVG Circular Indicator
    const radius = 9;
    const circumference = radius * 2 * Math.PI;
    charProgressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const percent = Math.max(0, Math.min(100, (currentLength / 280) * 100));
    const offset = circumference - (percent / 100) * circumference;
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Change circle color close to limit
    if (remaining < 0) {
        charProgressCircle.style.stroke = 'var(--color-deprecation)';
    } else if (remaining <= 20) {
        charProgressCircle.style.stroke = 'hsl(45, 100%, 50%)';
    } else {
        charProgressCircle.style.stroke = 'var(--color-primary)';
    }
}

// Append recommendation hashtags
function appendHashtag(hashtag) {
    const text = tweetTextarea.value;
    
    // Check if tag is already there
    if (text.includes(hashtag)) return;
    
    // Find where the link is, insert tags before it or at the end
    const notesMatch = text.indexOf('\n\nNotes:');
    if (notesMatch !== -1) {
        const preNotes = text.substring(0, notesMatch);
        const postNotes = text.substring(notesMatch);
        
        // Add spacing if needed
        const spacing = preNotes.endsWith(' ') ? '' : ' ';
        tweetTextarea.value = `${preNotes}${spacing}${hashtag}${postNotes}`;
    } else {
        const spacing = text.endsWith(' ') || text.length === 0 ? '' : ' ';
        tweetTextarea.value = `${text}${spacing}${hashtag}`;
    }
    
    updateTweetStats();
}

// Clear active selected notes
function clearSelection() {
    selectedUpdateId = null;
    document.querySelectorAll('.update-section').forEach(card => {
        card.classList.remove('selected');
    });
    
    tweetTextarea.value = '';
    updateTweetStats();
    selectionBanner.style.display = 'none';
}

// Copy constructed tweet to clipboard
async function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    if (!text.trim()) {
        showToast('Composer is empty! Select an update first.', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        showToast('Tweet copied to clipboard!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Clipboard copy failed. Please select and copy manually.', 'error');
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Refresh feed
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search interactions
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndSearch();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });
    
    // Tag Filters clicks
    filterTagsList.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tag-filter-btn')) return;
        
        document.querySelectorAll('.tag-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        e.target.classList.add('active');
        activeFilter = e.target.dataset.type;
        applyFiltersAndSearch();
    });
    
    // Reset Filters helper button
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        document.querySelectorAll('.tag-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === 'all') btn.classList.add('active');
        });
        
        activeFilter = 'all';
        applyFiltersAndSearch();
    });
    
    // Tweet composer input listener
    tweetTextarea.addEventListener('input', updateTweetStats);
    
    // Copy/Clear compose events
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    clearSelectionBtn.addEventListener('click', clearSelection);
}

// Page load initialization
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleaseNotes(false);
    updateTweetStats(); // Init character counter progress circle
});
