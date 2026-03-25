/**
 * nav.js — Retractable Nav
 *
 * Fades the nav out after 2.8 s of inactivity.
 * Snaps back in on any mouse or touch movement.
 */
 
const nav = document.getElementById('siteNav');
let hideTimer = null;
 
const showNav = () => {
    nav.classList.remove('nav-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => nav.classList.add('nav-hidden'), 2800);
};
 
document.addEventListener('mousemove', showNav, { passive: true });
document.addEventListener('touchstart', showNav, { passive: true });
 
// Show on load, then start the idle timer
showNav();