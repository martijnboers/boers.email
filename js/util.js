'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const yearElement = document.getElementById("year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});
