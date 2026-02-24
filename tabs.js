/**
 * Tabbed Toolbox Manager
 * Handles tab switching between Tools and Filters
 */

// Initialize tabs on page load
document.addEventListener('DOMContentLoaded', function () {
    initializeTabs();
});

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log("initializeTabs running. Found buttons:", tabButtons.length);

    if (tabButtons.length === 0) {
        console.warn('No tab buttons found');
        return;
    }

    // Add click handlers to all tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            console.log('Tab clicked:', this.getAttribute('data-tab'));
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Load saved tab from localStorage
    const savedTab = localStorage.getItem('activeToolboxTab');
    if (savedTab) {
        switchTab(savedTab);
    } else {
        // Default to Tools tab
        switchTab('tools');
    }

    // Force width update
    const activeTabObj = document.querySelector('.tab-btn.active');
    if (activeTabObj) {
        const tName = activeTabObj.getAttribute('data-tab');
        const toolboxContainer = document.getElementById('leftToolboxContainer');
        if (toolboxContainer) {
            if (tName === 'filters') {
                toolboxContainer.style.width = '240px';
            } else {
                toolboxContainer.style.width = '68px';
            }
        }
    }

    console.log('Tabs initialized');
}

function switchTab(tabName) {
    // Deactivate all tabs
    const allTabButtons = document.querySelectorAll('.tab-btn');
    const allTabPanes = document.querySelectorAll('.tab-pane');

    allTabButtons.forEach(btn => btn.classList.remove('active'));
    allTabPanes.forEach(pane => pane.classList.remove('active'));

    // Activate selected tab
    const activeButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`${tabName}-tab`);

    if (activeButton && activePane) {
        activeButton.classList.add('active');
        activePane.classList.add('active');

        // Resize container based on tab
        const toolboxContainer = document.getElementById('leftToolboxContainer');
        if (toolboxContainer) {
            if (tabName === 'filters') {
                toolboxContainer.style.width = '240px'; // Wider for filters
            } else {
                toolboxContainer.style.width = '68px'; // Standard narrow width for tools
            }
        }

        // Save to localStorage
        localStorage.setItem('activeToolboxTab', tabName);

        console.log(`Switched to ${tabName} tab`);
    } else {
        console.error(`Tab ${tabName} not found`);
    }
}

// Export for external use
window.switchTab = switchTab;
