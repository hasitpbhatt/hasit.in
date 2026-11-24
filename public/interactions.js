document.addEventListener('DOMContentLoaded', function() {
    // Toast Notification System
    const toast = document.createElement('div');
    toast.className = 'trx-toast';
    document.body.appendChild(toast);

    window.showTrxToast = function(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };

    // Clipboard Copy Helper
    document.querySelectorAll('.copy-trigger').forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            const textToCopy = this.getAttribute('data-copy');
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    window.showTrxToast('Copied to clipboard!');
                }).catch(() => {
                    // Fallback
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        window.showTrxToast('Copied to clipboard!');
                    } catch (err) {
                        window.showTrxToast('Failed to copy');
                    }
                    document.body.removeChild(textarea);
                });
            }
        });
    });

    // Wallet address input live validation (Optimized for INP)
    const addressInput = document.querySelector('input[name="address"]');
    const referralLinkInput = document.getElementById('referral-link');
    const copyReferralBtn = document.getElementById('copy-referral');
    if (addressInput) {
        let validationFrame = null;
        addressInput.addEventListener('input', function() {
            const val = this.value.trim();
            const inputEl = this;
            if (validationFrame) cancelAnimationFrame(validationFrame);
            validationFrame = requestAnimationFrame(() => {
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                if (val === '') {
                    inputEl.style.borderColor = 'var(--border-strong)';
                } else if (tronRegex.test(val)) {
                    inputEl.style.borderColor = 'var(--success)';
                } else {
                    inputEl.style.borderColor = 'var(--danger)';
                }

                // Keep the referral link in sync with the typed address.
                if (referralLinkInput && tronRegex.test(val)) {
                    const link = 'https://trx.hasit.in/?r=' + encodeURIComponent(val);
                    referralLinkInput.value = link;
                    if (copyReferralBtn) copyReferralBtn.setAttribute('data-copy', link);
                }
            });
        });
    }

    // Cooldown countdown timer logic integration (if timer exists on page)
    const countdownEl = document.querySelector('.trx-countdown');
    if (countdownEl) {
        let secondsLeft = parseInt(countdownEl.getAttribute('data-seconds') || '0', 10);
        if (secondsLeft > 0) {
            const interval = setInterval(() => {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    clearInterval(interval);
                    location.reload();
                } else {
                    const mins = Math.floor(secondsLeft / 60);
                    const secs = secondsLeft % 60;
                    countdownEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
            }, 1000);
        }
    }

    // Dropdown menu for nav
    const dropdownTrigger = document.querySelector('.nav-dropdown-trigger');
    const dropdownMenu = document.querySelector('.nav-dropdown-menu');
    if (dropdownTrigger && dropdownMenu) {
        dropdownTrigger.addEventListener('click', function(e) {
            e.stopPropagation();
            const expanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', (!expanded).toString());
            dropdownMenu.style.display = expanded ? 'none' : 'block';
        });
        document.addEventListener('click', function() {
            dropdownTrigger.setAttribute('aria-expanded', 'false');
            dropdownMenu.style.display = 'none';
        });
    }
});