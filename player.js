document.addEventListener('DOMContentLoaded', async () => {
    // --- Global State ---
    let seasonsData, specialsData; // All fetched data
    let currentContent; // The specific season or special object

    // --- Configuration ---
    // IMPORTANT: Replace 'your-public-bucket-name' with your actual Google Cloud Storage bucket name.
    const GCS_BUCKET_NAME = 'rj-dubbers-videos93';

    // --- Get elements from the DOM ---
    const videoElement = document.getElementById('player-video-element');
    const titleElement = document.getElementById('player-title');
    const descriptionElement = document.getElementById('player-description');
    const episodeListElement = document.getElementById('episode-list');
    const pageTitle = document.querySelector('title');

    const downloadModal = document.getElementById('download-modal');
    const downloadOptionsList = document.getElementById('download-options-list');

    // --- Data Fetching ---
    async function fetchData() {
        try {
            const [seasonsResult, specialsResult] = await Promise.all([
                fetch('seasons.json'),
                fetch('specials.json')
            ]);

            // Check if fetches were successful before parsing JSON
            const seasonsData = seasonsResult.ok ? await seasonsResult.json() : null;
            const specialsData = specialsResult.ok ? await specialsResult.json() : null;

            if (!seasonsResult.ok) console.warn('Failed to fetch seasons.json');
            if (!specialsResult.ok) console.warn('Failed to fetch specials.json');

            return { 
                seasonsData: seasonsResult, 
                specialsData: specialsResult, 
                error: null 
            };
        } catch (error) {
            console.error("Critical error fetching content data:", error);
            return { seasonsData: null, specialsData: null, error };
        }
    }

    // --- Functions ---
    function getProgress() {
        try {
            const progress = localStorage.getItem('btthProgress');
            return progress ? JSON.parse(progress) : {};
        } catch (e) {
            console.warn("Could not access localStorage. Progress will not be saved.", e);
            return {};
        }
    }

    function saveProgress(id, episodeIndex) {
        try {
            const progress = getProgress();
            const key = (currentContent.isSpecial ? 'special_' : 'season_') + id;
            if (!progress[key]) {
                progress[key] = [];
            }
            if (!progress[key].includes(episodeIndex)) {
                progress[key].push(episodeIndex);
            }
            localStorage.setItem('btthProgress', JSON.stringify(progress));
        } catch (e) {
            console.warn("Could not access localStorage. Progress could not be saved.", e);
        }
    }

    function removeProgress(id, episodeIndex) {
        try {
            const progress = getProgress();
            const key = (currentContent.isSpecial ? 'special_' : 'season_') + id;
            if (progress[key] && progress[key].includes(episodeIndex)) {
                progress[key] = progress[key].filter(index => index !== episodeIndex);
                if (progress[key].length === 0) {
                    delete progress[key];
                }
                localStorage.setItem('btthProgress', JSON.stringify(progress));
            }
        } catch (e) {
            console.warn("Could not access localStorage. Progress could not be updated.", e);
        }
    }

    function getLastPlayed() {
        try {
            const lastPlayed = localStorage.getItem('btthLastPlayed');
            return lastPlayed ? JSON.parse(lastPlayed) : {};
        } catch (e) {
            console.warn("Could not access localStorage. Last played episode will not be loaded.", e);
            return {};
        }
    }

    function saveLastPlayed(id, episodeIndex) {
        try {
            const lastPlayed = getLastPlayed();
            const key = (currentContent.isSpecial ? 'special_' : 'season_') + id;
            lastPlayed[key] = episodeIndex;
            localStorage.setItem('btthLastPlayed', JSON.stringify(lastPlayed));
        } catch (e) {
            console.warn("Could not access localStorage. Last played episode could not be saved.", e);
        }
    }

    function updateUI() {
        if (!currentContent.data) {
            console.error('No season data provided for updateUI');
            return;
        }
        document.body.classList.remove('content-not-found');

        // Populate static details
        pageTitle.textContent = `Watch ${currentContent.data.title} | RJ Dubbers`;
        descriptionElement.textContent = 'Select an episode from the list to see its description.';

        // Populate VAs
        const vaContainer = document.querySelector('.player-vas');
        if (vaContainer && currentContent.data.vas) {
            const vas = currentContent.data.vas.split(',');
            const vaListHTML = vas.map(va => {
                const parts = va.split(':');
                if (parts.length < 2) return '';
                const character = parts[0].trim();
                const actor = parts[1].trim();
                return `<li><strong>${character}:</strong> ${actor}</li>`;
            }).join('');

            vaContainer.innerHTML = vaListHTML
                ? `<h3>Key Voice Actors</h3><ul id="player-va-list">${vaListHTML}</ul>`
                : '';
        }

        // Populate Episodes
        episodeListElement.innerHTML = '';
        if (currentContent.data.episodes && currentContent.data.episodes.length > 0) {
            const progressKey = (currentContent.isSpecial ? 'special_' : 'season_') + currentContent.id;
            const progress = getProgress()[progressKey] || [];
            
            currentContent.data.episodes.forEach((episode, index) => {
                const li = document.createElement('li');
                li.dataset.index = index;
                li.setAttribute('role', 'button');
                li.setAttribute('tabindex', '0');

                if (progress.includes(index)) {
                    li.classList.add('watched');
                }

                li.innerHTML = `
                    <div class="episode-info-wrapper">
                        <span class="watched-indicator" title="Mark as unwatched">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z" fill="currentColor"/></svg>
                        </span>
                        <span class="episode-title">${episode.title}</span>
                    </div>
                `;
                episodeListElement.appendChild(li);
            });
        } else {
            episodeListElement.innerHTML = '<li>Episodes coming soon...</li>';
        }
    }

    function playEpisode(element, index, shouldSave = true) {
        if (!element) {
            console.error("playEpisode was called without a valid element.");
            return;
        }

        const episodeData = currentContent.data.episodes[index];
        if (!episodeData || !episodeData.src) {
            console.error("No video sources found for this episode.");
            return;
        }

        // Update video player source
        videoElement.src = episodeData.src;
        videoElement.load();

        // Try to play, but catch errors if autoplay is blocked
        videoElement.play().catch(error => {
            console.log("Autoplay was prevented or video failed to load:", error);
        });

        // Update title under video
        titleElement.textContent = episodeData.title;

        // Update episode description
        descriptionElement.textContent = episodeData.description || 'No description available for this episode.';

        // Save this as the last played episode
        saveLastPlayed(currentContent.id, index);

        // Update styles
        document.querySelectorAll('#episode-list li').forEach(li => li.classList.remove('playing'));
        element.classList.add('playing');

        // Scroll the playing item into view
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Also scroll the main video player into view for better UX on mobile
        videoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Save progress
        if (shouldSave) {
            saveProgress(currentContent.id, index);
            if (!element.classList.contains('watched')) {
                element.classList.add('watched');
            }
        }
    }

    videoElement.addEventListener('ended', () => {
        const currentPlaying = document.querySelector('#episode-list li.playing');
        if (currentPlaying) {
            const nextEpisodeElement = currentPlaying.nextElementSibling;
            if (nextEpisodeElement && nextEpisodeElement.dataset.index) {
                const nextIndex = parseInt(nextEpisodeElement.dataset.index, 10);
                if (!isNaN(nextIndex) && currentContent.data.episodes[nextIndex]) {
                    playEpisode(nextEpisodeElement, nextIndex);
                }
            }
        }
    });

    // --- Modal Management ---
    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
    }

    function hideModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', hideModals);
    });
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModals();
        });
    });

    // --- Initial Page Load ---
    async function initializePlayer() {
        // 1. Try to fetch data
        const data = await fetchData();
        
        // 2. Check if we have valid data
        if (data.error || (!data.seasonsData && !data.specialsData)) {
            console.error('CRITICAL: No JSON data found. Please create seasons.json and specials.json files.');
            handleContentNotFound("Content data not found. Please check if seasons.json and specials.json files exist.");
            return;
        }

        seasonsData = data.seasonsData;
        specialsData = data.specialsData;

        // 3. Determine which content to load from URL
        const urlParams = new URLSearchParams(window.location.search);
        const seasonId = urlParams.get('season');
        const specialId = urlParams.get('special');
        const isSpecial = !!specialId;
        const contentId = isSpecial ? specialId : seasonId;

        const dataSource = isSpecial ? specialsData : seasonsData;
        
        // 4. Check if requested content exists
        if (!contentId || !dataSource || !dataSource[contentId]) {
            handleContentNotFound(`The requested content (ID: ${contentId}) was not found.`);
            return;
        }

        // 5. Set the global current content object
        currentContent = {
            id: contentId,
            isSpecial: isSpecial,
            data: dataSource[contentId]
        };
        console.log('Found content data:', currentContent.data);

        // 6. Update UI with the data
        updateUI();

        // 7. Load first episode or last played episode
        if (currentContent.data.episodes && currentContent.data.episodes.length > 0) {
            const lastPlayed = getLastPlayed();
            const lastPlayedKey = (currentContent.isSpecial ? 'special_' : 'season_') + currentContent.id;
            let episodeToLoadIndex = 0;
            
            if (lastPlayed[lastPlayedKey] !== undefined) {
                const savedIndex = lastPlayed[lastPlayedKey];
                if (savedIndex >= 0 && savedIndex < currentContent.data.episodes.length) {
                    episodeToLoadIndex = savedIndex;
                }
            }

            const episodeElementToLoad = episodeListElement.querySelector(`li[data-index="${episodeToLoadIndex}"]`);
            if (episodeElementToLoad) {
                playEpisode(episodeElementToLoad, episodeToLoadIndex, false);
            }
        }

        // 8. Add event listeners for episode interaction
        function handleEpisodeInteraction(e) {
            const li = e.target.closest('li[data-index]');
            if (!li) return;

            const episodeIndex = parseInt(li.dataset.index, 10);
            if (isNaN(episodeIndex)) return;

            // Check which part of the episode item was interacted with
            if (e.target.closest('.watched-indicator')) {
                removeProgress(currentContent.id, episodeIndex);
                li.classList.remove('watched');
            } else {
                // Default action: play the episode
                playEpisode(li, episodeIndex);
            }
        }

        episodeListElement.addEventListener('click', handleEpisodeInteraction);

        episodeListElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent space from scrolling the page
                handleEpisodeInteraction(e);
            }
        });

        // 9. Add Global Keyboard Shortcuts for Video Player
        function toggleFullScreen() {
            if (!document.fullscreenElement) {
                // Use the wrapper to make the controls part of the fullscreen experience
                const playerWrapper = document.querySelector('.player-video-wrapper');
                if (playerWrapper.requestFullscreen) {
                    playerWrapper.requestFullscreen();
                } else if (playerWrapper.mozRequestFullScreen) { /* Firefox */
                    playerWrapper.mozRequestFullScreen();
                } else if (playerWrapper.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                    playerWrapper.webkitRequestFullscreen();
                } else if (playerWrapper.msRequestFullscreen) { /* IE/Edge */
                    playerWrapper.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }

        document.addEventListener('keydown', (e) => {
            // Ignore shortcuts if the user is focused on an input, button, or the episode list itself
            const activeEl = document.activeElement;
            const isInteractiveElement = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'BUTTON' ||
                activeEl.closest('#episode-list')
            );

            if (isInteractiveElement && e.key !== 'Escape') return;

            // Handle shortcuts
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    videoElement.paused ? videoElement.play() : videoElement.pause();
                    break;
                case 'ArrowRight':
                    videoElement.currentTime += 5;
                    break;
                case 'ArrowLeft':
                    videoElement.currentTime -= 5;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    videoElement.volume = Math.min(1, videoElement.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    videoElement.volume = Math.max(0, videoElement.volume - 0.1);
                    break;
                case 'm':
                case 'M':
                    videoElement.muted = !videoElement.muted;
                    break;
                case 'f':
                case 'F':
                    toggleFullScreen();
                    break;
            }
        });
    }
    
    function handleContentNotFound(customMessage = "") {
        console.log('Handling content not found...');
        document.body.classList.add('content-not-found');

        if (titleElement) titleElement.textContent = "Content Not Found";
        if (descriptionElement) {
            const detailsWrapper = descriptionElement.parentElement;
            const message = customMessage || `The content you're looking for could not be loaded. This usually happens if you access this page directly without selecting a season or special.`;
            detailsWrapper.innerHTML = `
                <p>${message}</p>
                <p>Please return to the homepage to make a selection.</p>
                <a href="index.html" class="watch-button">Go to Homepage</a>
            `;
        }
    }

    // Start the player
    await initializePlayer();
});