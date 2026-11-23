/**
 * memory-game.js — Memory Match Game for TRX Faucet
 * 12 cards, 6 pairs, flip animation, match counter
 */
(function () {
  'use strict';

  // 12 emojis (6 pairs)
  var EMOJI_PAIRS = ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊'];

  var area = document.getElementById('game_area');
  if (!area) return;

  var cardsEl = document.getElementById('game_cards');
  var statusEl = document.getElementById('game_status');
  var submitBtn = document.getElementById('claimbtn');
  var addressInput = document.querySelector('input[name="address"]');

  if (!cardsEl || !submitBtn) return;

  // Turnstile injects this input asynchronously and may replace it on retry,
  // so always look it up fresh instead of caching a possibly-null element.
  function getTurnstileResponse() {
    return document.querySelector('input[name="cf-turnstile-response"]');
  }

  var state = {
    flipped: [],
    matched: 0,
    done: false,
    lockBoard: false
  };

  function shuffled(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function createDeck() {
    var deck = [];
    EMOJI_PAIRS.forEach(function (emo) {
      deck.push({ emoji: emo, id: emo + '_a' });
      deck.push({ emoji: emo, id: emo + '_b' });
    });
    return shuffled(deck);
  }

  function render() {
    var deck = createDeck();
    cardsEl.innerHTML = '';
    deck.forEach(function (card) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'game-card';
      btn.dataset.emoji = card.emoji;
      btn.dataset.id = card.id;
      btn.innerHTML =
        '<span class="card-back">?</span>' +
        '<span class="card-front">' + card.emoji + '</span>';
      btn.addEventListener('click', onCardClick);
      cardsEl.appendChild(btn);
    });
    state.flipped = [];
    state.matched = 0;
    state.done = false;
    state.lockBoard = false;
    updateStatus('Flip and match all emoji pairs to unlock the faucet claim.');
  }

  function updateStatus(msg, isSuccess) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'game-status' + (isSuccess ? ' success' : '');
  }

  function onCardClick(e) {
    var card = e.currentTarget;
    if (state.lockBoard) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    if (state.flipped.length >= 2) return;

    flipCard(card);
    state.flipped.push(card);

    if (state.flipped.length === 2) {
      state.lockBoard = true;
      checkMatch();
    }
  }

  function flipCard(card) {
    card.classList.add('flipped');
  }

  function unflipCards() {
    state.flipped.forEach(function (card) {
      card.classList.remove('flipped');
    });
    state.flipped = [];
    state.lockBoard = false;
  }

  function checkMatch() {
    var emoji1 = state.flipped[0].dataset.emoji;
    var emoji2 = state.flipped[1].dataset.emoji;

    if (emoji1 === emoji2) {
      markMatched();
    } else {
      setTimeout(unflipCards, 1000);
    }
  }

  function markMatched() {
    state.flipped.forEach(function (card) {
      card.classList.remove('flipped');
      card.classList.add('matched');
      card.removeEventListener('click', onCardClick);
    });
    state.matched += 1;
    state.flipped = [];
    state.lockBoard = false;

    updateStatus('Matched ' + state.matched + ' of ' + EMOJI_PAIRS.length + ' pairs', true);

    if (state.matched === EMOJI_PAIRS.length) {
      state.done = true;
      gameComplete();
    }
  }

  function gameComplete() {
    updateStatus('All pairs matched! Complete the captcha and claim your TRX.', true);
    if (window.showTrxToast) window.showTrxToast('Game solved! Complete the captcha to claim.');
    checkReadyToClaim();
  }

  function checkReadyToClaim() {
    var turnstileResponse = getTurnstileResponse();
    var hasAddress = addressInput && addressInput.value.trim().length > 0;
    var hasTurnstile = !!(turnstileResponse && turnstileResponse.value.length > 0);

    if (state.done && hasAddress && hasTurnstile) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('d-none');
      submitBtn.textContent = 'Claim your TRX!';
    } else {
      submitBtn.disabled = true;
    }
  }

  // Listen for address input
  if (addressInput) {
    addressInput.addEventListener('input', function () {
      if (state.done) checkReadyToClaim();
    });
  }

  // Poll continuously: the input appears late, can be replaced, and its
  // token expires. Never stop checking, or an expired token stays enabled.
  setInterval(checkReadyToClaim, 500);

  // Initialize
  render();

  // Turnstile callback hooks (see the .cf-turnstile element in templates.ts)
  window.trxTurnstileSolved = checkReadyToClaim;
  window.trxTurnstileExpired = checkReadyToClaim;

  // Expose for testing
  window.trxMemoryGame = { render: render, state: state, checkReadyToClaim: checkReadyToClaim };
})();