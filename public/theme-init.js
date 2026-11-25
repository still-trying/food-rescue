(function () {
  try {
    var stored = window.localStorage.getItem('food-rescue-theme')
    var prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    var isDark = stored === 'dark' || (stored !== 'light' && prefersDark)

    var root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'

    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', isDark ? '#09120e' : '#16a34a')
    }
  } catch {
    // Ignore storage access failures
  }
})()
