class DarkMode {
  constructor() {
    this.toggleButton = document.getElementById('dark-mode-toggle');
    this.networkImage = document.getElementById('network-image'); // Reference to the network image
    this.init();
  }

  init() {
    // Check for saved preference or system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode === 'enabled' || (!savedMode && prefersDark)) {
      this.enableDarkMode();
    }

    // Add event listener if toggle exists on this page
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => this.toggleMode());
    }
  }

  toggleMode() {
    if (document.body.classList.contains('dark-mode')) {
      this.disableDarkMode();
    } else {
      this.enableDarkMode();
    }
  }

  enableDarkMode() {
    document.body.classList.add('dark-mode');
    this.updateToggleButton(true);
    // Update network image to dark version
    if (this.networkImage) {
      this.networkImage.src = '/static/Images/darknetwork.png';
    }
    localStorage.setItem('darkMode', 'enabled');
  }

  disableDarkMode() {
    document.body.classList.remove('dark-mode');
    this.updateToggleButton(false);
    // Update network image to light version
    if (this.networkImage) {
      this.networkImage.src = '/static/Images/network.png';
    }
    localStorage.setItem('darkMode', 'disabled');
  }

  updateToggleButton(isDark) {
    if (this.toggleButton) {
      this.toggleButton.innerHTML = isDark 
        ? '<i class="fas fa-sun"></i> Light Mode' 
        : '<i class="fas fa-moon"></i> Dark Mode';
    }
  }
}

// Initialize on all pages
document.addEventListener('DOMContentLoaded', () => {
  const darkMode = new DarkMode();
  
  // Apply dark mode based on saved preference
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    // Ensure network image is set to dark version on page load
    const networkImage = document.getElementById('network-image');
    if (networkImage) {
      networkImage.src = '/static/Images/darknetwork.png';
    }
  }
});