(() => {
  const SIZE = 4;
  const START_TILES = 2;
  const KEY_TO_DIR = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  const els = {
    board: document.getElementById('board'),
    grid: document.getElementById('grid'),
    tiles: document.getElementById('tiles'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    newGame: document.getElementById('newGame'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    tryAgain: document.getElementById('tryAgain'),
    cont: document.getElementById('continue'),
  };

  let state = null;
  let animLock = false;
  let touch = { active: false, x: 0, y: 0, t: 0 };

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function makeEmptyCells() {
    els.grid.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      els.grid.appendChild(c);
    }
  }

  function getMetrics() {
    const rect = els.tiles.getBoundingClientRect();
    const style = getComputedStyle(els.board);
    const gap = parseFloat(style.getPropertyValue('--gap'));
    const cell = (rect.width - gap * (SIZE - 1)) / SIZE;
    return { gap, cell, width: rect.width, height: rect.height };
  }

  function posToPx(row, col, metrics) {
    const x = col * (metrics.cell + metrics.gap);
    const y = row * (metrics.cell + metrics.gap);
    return { x, y };
  }

  function newId() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function initState() {
    const best = Number(localStorage.getItem('bestScore') || 0);
    state = {
      score: 0,
      best,
      won: false,
      over: false,
      keepPlaying: false,
      tilesById: new Map(),
      grid: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
      domById: new Map(),
    };
    els.score.textContent = '0';
    els.best.textContent = String(best);
    hideOverlay();
    for (let i = 0; i < START_TILES; i++) spawnTile();
    render({ newIds: new Set(state.tilesById.keys()) });
  }

  function emptyPositions() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!state.grid[r][c]) empty.push([r, c]);
      }
    }
    return empty;
  }

  function spawnTile() {
    const empties = emptyPositions();
    if (empties.length === 0) return null;
    const [r, c] = randChoice(empties);
    const id = newId();
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = { id, value, row: r, col: c };
    state.tilesById.set(id, tile);
    state.grid[r][c] = id;
    return id;
  }

  function canMove() {
    if (emptyPositions().length > 0) return true;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const id = state.grid[r][c];
        const t = state.tilesById.get(id);
        if (r + 1 < SIZE) {
          const id2 = state.grid[r + 1][c];
          const t2 = state.tilesById.get(id2);
          if (t.value === t2.value) return true;
        }
        if (c + 1 < SIZE) {
          const id2 = state.grid[r][c + 1];
          const t2 = state.tilesById.get(id2);
          if (t.value === t2.value) return true;
        }
      }
    }
    return false;
  }

  function setOverlay(kind) {
    els.overlay.hidden = false;
    if (kind === 'win') {
      els.overlayTitle.textContent = 'You win!';
      els.overlayText.textContent = 'Keep going or start a new game.';
      els.cont.hidden = false;
    } else {
      els.overlayTitle.textContent = 'Game over';
      els.overlayText.textContent = 'No more moves.';
      els.cont.hidden = true;
    }
  }

  function hideOverlay() {
    els.overlay.hidden = true;
  }

  function eachLine(dir, fn) {
    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) fn(r);
    } else {
      for (let c = 0; c < SIZE; c++) fn(c);
    }
  }

  function getLine(dir, index) {
    const ids = [];
    if (dir === 'left') {
      for (let c = 0; c < SIZE; c++) ids.push(state.grid[index][c]);
    } else if (dir === 'right') {
      for (let c = SIZE - 1; c >= 0; c--) ids.push(state.grid[index][c]);
    } else if (dir === 'up') {
      for (let r = 0; r < SIZE; r++) ids.push(state.grid[r][index]);
    } else {
      for (let r = SIZE - 1; r >= 0; r--) ids.push(state.grid[r][index]);
    }
    return ids;
  }

  function setLine(dir, index, ids) {
    for (let offset = 0; offset < SIZE; offset++) {
      const pos = lineTargetPos(dir, index, offset);
      state.grid[pos.row][pos.col] = ids[offset];
    }
  }

  function lineTargetPos(dir, lineIndex, offsetInLine) {
    if (dir === 'left') return { row: lineIndex, col: offsetInLine };
    if (dir === 'right') return { row: lineIndex, col: SIZE - 1 - offsetInLine };
    if (dir === 'up') return { row: offsetInLine, col: lineIndex };
    return { row: SIZE - 1 - offsetInLine, col: lineIndex };
  }

  function move(dir) {
    if (animLock || state.over || (state.won && !state.keepPlaying)) return;

    const before = snapshotTiles();
    const moved = new Map();
    const toRemove = new Set();
    const ghostIds = new Set();
    const mergedInto = new Set();
    let scoreGain = 0;

    eachLine(dir, (idx) => {
      const original = getLine(dir, idx);
      const compact = original.filter(Boolean);
      const out = [];
      let i = 0;

      while (i < compact.length) {
        const aId = compact[i];
        const a = state.tilesById.get(aId);
        const bId = compact[i + 1];
        const b = bId ? state.tilesById.get(bId) : null;

        if (b && a.value === b.value) {
          const newId2 = newId();
          const newVal = a.value * 2;
          scoreGain += newVal;

          const tPos = lineTargetPos(dir, idx, out.length);
          const newTile = { id: newId2, value: newVal, row: tPos.row, col: tPos.col };

          moved.set(aId, { to: tPos, merged: true, into: newId2 });
          moved.set(bId, { to: tPos, merged: true, into: newId2 });
          toRemove.add(aId);
          toRemove.add(bId);
          ghostIds.add(aId);
          ghostIds.add(bId);

          state.tilesById.set(newId2, newTile);
          mergedInto.add(newId2);
          out.push(newId2);
          i += 2;
        } else {
          const tPos = lineTargetPos(dir, idx, out.length);
          moved.set(aId, { to: tPos, merged: false });
          out.push(aId);
          i += 1;
        }
      }

      while (out.length < SIZE) out.push(null);
      setLine(dir, idx, out);
    });

    let changed = false;
    for (const [id, beforePos] of before.entries()) {
      const tile = state.tilesById.get(id);
      if (!tile) continue;
      const to = moved.get(id)?.to;
      if (to && (beforePos.row !== to.row || beforePos.col !== to.col)) changed = true;
      if (to) {
        tile.row = to.row;
        tile.col = to.col;
      }
    }

    for (const id of ghostIds) {
      const tile = state.tilesById.get(id);
      if (tile) tile.ghost = true;
    }

    if (!changed && mergedInto.size === 0) return;

    state.score += scoreGain;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('bestScore', String(state.best));
    }

    const spawned = spawnTile();

    if (!state.won) {
      for (const t of state.tilesById.values()) {
        if (t.value === 2048) {
          state.won = true;
          break;
        }
      }
    }

    if (!canMove()) state.over = true;

    animLock = true;
    render({
      newIds: new Set(spawned ? [spawned] : []),
      mergeIds: mergedInto,
      removedIds: toRemove,
    });

    window.setTimeout(() => {
      for (const id of toRemove) {
        state.tilesById.delete(id);
        const el = state.domById.get(id);
        if (el) {
          el.remove();
          state.domById.delete(id);
        }
      }
      animLock = false;
      if (state.over) setOverlay('over');
      else if (state.won && !state.keepPlaying) setOverlay('win');
    }, 170);
  }

  function snapshotTiles() {
    const m = new Map();
    for (const [id, t] of state.tilesById.entries()) m.set(id, { row: t.row, col: t.col, value: t.value });
    return m;
  }

  function ensureTileDom(id) {
    const tile = state.tilesById.get(id);
    if (!tile) return null;

    let el = state.domById.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tile';
      el.dataset.id = id;
      const inner = document.createElement('div');
      inner.className = 'tileInner';
      el.appendChild(inner);
      state.domById.set(id, el);
      els.tiles.appendChild(el);
    }

    const inner = el.firstElementChild;
    inner.textContent = String(tile.value);

    el.classList.remove(
      'v2','v4','v8','v16','v32','v64','v128','v256','v512','v1024','v2048','v4096','v8192',
      'new','merge','ready','ghost'
    );
    el.classList.add('v' + tile.value);
    if (tile.ghost) el.classList.add('ghost');

    return el;
  }

  function render({ newIds = new Set(), mergeIds = new Set(), removedIds = new Set() } = {}) {
    els.score.textContent = String(state.score);
    els.best.textContent = String(state.best);

    const metrics = getMetrics();
    const used = new Set();

    for (const t of state.tilesById.values()) {
      const el = ensureTileDom(t.id);
      if (!el) continue;

      used.add(t.id);

      el.style.width = metrics.cell + 'px';
      el.style.height = metrics.cell + 'px';

      const { x, y } = posToPx(t.row, t.col, metrics);
      el.style.transform = `translate(${x}px, ${y}px)`;

      if (newIds.has(t.id)) el.classList.add('new');
      if (mergeIds.has(t.id)) el.classList.add('merge');
    }

    for (const [id, el] of state.domById.entries()) {
      if (!used.has(id)) {
        el.remove();
        state.domById.delete(id);
      }
    }

    requestAnimationFrame(() => {
      for (const id of newIds) {
        const el = state.domById.get(id);
        if (el) el.classList.add('ready');
      }
      for (const id of mergeIds) {
        const el = state.domById.get(id);
        if (el) el.classList.add('ready');
      }
    });
  }

  function onKeyDown(e) {
    if (e.key === 'n' || e.key === 'N') {
      initState();
      return;
    }

    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  }

  function onResize() {
    if (!state) return;
    render();
  }

  function getSwipeDir(dx, dy) {
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    els.board.setPointerCapture(e.pointerId);
    touch.active = true;
    touch.x = e.clientX;
    touch.y = e.clientY;
    touch.t = performance.now();
  }

  function onPointerUp(e) {
    if (!touch.active) return;
    touch.active = false;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    const dt = performance.now() - touch.t;

    const dir = getSwipeDir(dx, dy);
    if (!dir) return;
    if (dt > 600 && Math.hypot(dx, dy) < 40) return;

    move(dir);
  }

  function bind() {
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('resize', onResize);

    els.newGame.addEventListener('click', () => initState());
    els.tryAgain.addEventListener('click', () => initState());
    els.cont.addEventListener('click', () => {
      state.keepPlaying = true;
      hideOverlay();
    });

    els.board.addEventListener('pointerdown', onPointerDown);
    els.board.addEventListener('pointerup', onPointerUp);
    els.board.addEventListener('pointercancel', () => (touch.active = false));
  }

  makeEmptyCells();
  bind();
  initState();
})();
