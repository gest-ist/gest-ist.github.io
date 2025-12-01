// Minimal main.js — language toggle, navbar burger, smooth scroll, navbar offset, carousel scroll
document.addEventListener('DOMContentLoaded', function () {
  // Navbar burger toggle (accessible)
  var burgers = document.querySelectorAll('.navbar-burger');
  burgers.forEach(function (burger) {
    var targetId = burger.dataset.target;
    var menu = document.getElementById(targetId);
    burger.addEventListener('click', function () {
      var expanded = burger.classList.toggle('is-active');
      burger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (menu) menu.classList.toggle('is-active');
    });
  });

  // Language selector (show/hide elements with lang classes)
  var selector = document.getElementById('language-selector');
  var allLangSections = document.querySelectorAll('.lang');
  if (selector) {
    selector.addEventListener('change', function () {
      var lang = this.value;
      allLangSections.forEach(function (el) {
        if (el.classList.contains('lang-' + lang)) el.classList.remove('is-hidden');
        else el.classList.add('is-hidden');
      });
    });
  }

  // Smooth scroll for anchor links (with offset for fixed navbar)
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var yOffset = -60; // adjust if navbar height changes
        var y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  // Adjust main content margin for fixed navbar
  function adjustForNavbar() {
    var navbar = document.querySelector('.navbar');
    var main = document.getElementById('main-content');
    if (navbar && main) {
      var navbarHeight = navbar.offsetHeight;
      main.style.marginTop = navbarHeight + 'px';
    }
  }
  window.addEventListener('resize', adjustForNavbar);
  adjustForNavbar();

  // Carousel scroll helper for the gallery (buttons call scrollCarousel)
  window.scrollCarousel = function (direction) {
    var carousel = document.getElementById('carousel');
    if (!carousel) return;
    var scrollAmount = 320;
    carousel.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  };
});
