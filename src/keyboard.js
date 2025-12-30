// Keyboard component

const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export class Keyboard {
    constructor(container, onKeyPress) {
        this.container = container;
        this.onKeyPress = onKeyPress;
        this.keyStates = {}; // 'correct', 'present', 'absent'
        this.keys = {};

        this.render();
        this.addEventListeners();
    }

    render() {
        this.container.innerHTML = '';

        KEYBOARD_ROWS.forEach((row, rowIndex) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'keyboard-row';

            // Add spacer for middle row
            if (rowIndex === 1) {
                const spacer = document.createElement('div');
                spacer.style.flex = '0.5';
                rowEl.appendChild(spacer);
            }

            row.forEach(key => {
                const keyEl = document.createElement('button');
                keyEl.className = 'key';
                keyEl.dataset.key = key;

                if (key === 'ENTER') {
                    keyEl.classList.add('wide');
                    keyEl.textContent = 'Enter';
                } else if (key === 'BACKSPACE') {
                    keyEl.classList.add('wide');
                    keyEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
              <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"></path>
            </svg>
          `;
                } else {
                    keyEl.textContent = key;
                }

                keyEl.addEventListener('click', () => this.handleKeyClick(key));

                this.keys[key] = keyEl;
                rowEl.appendChild(keyEl);
            });

            // Add spacer for middle row
            if (rowIndex === 1) {
                const spacer = document.createElement('div');
                spacer.style.flex = '0.5';
                rowEl.appendChild(spacer);
            }

            this.container.appendChild(rowEl);
        });
    }

    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Don't intercept keys when typing in input fields
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return;
            }

            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const key = e.key.toUpperCase();

            if (key === 'ENTER') {
                this.handleKeyClick('ENTER');
                e.preventDefault();
            } else if (key === 'BACKSPACE') {
                this.handleKeyClick('BACKSPACE');
                e.preventDefault();
            } else if (/^[A-Z]$/.test(key)) {
                this.handleKeyClick(key);
                e.preventDefault();
            }
        });
    }

    handleKeyClick(key) {
        if (this.onKeyPress) {
            this.onKeyPress(key);
        }

        // Visual feedback
        const keyEl = this.keys[key];
        if (keyEl) {
            keyEl.style.transform = 'scale(0.95)';
            setTimeout(() => {
                keyEl.style.transform = '';
            }, 100);
        }
    }

    updateKeyState(letter, state) {
        const key = letter.toUpperCase();
        const keyEl = this.keys[key];

        if (!keyEl) return;

        // Only upgrade state (absent -> present -> correct)
        const currentState = this.keyStates[key];
        const stateOrder = { absent: 1, present: 2, correct: 3 };

        if (!currentState || stateOrder[state] > stateOrder[currentState]) {
            // Remove old state classes
            keyEl.classList.remove('correct', 'present', 'absent');

            // Add new state
            keyEl.classList.add(state);
            this.keyStates[key] = state;
        }
    }

    reset() {
        Object.keys(this.keys).forEach(key => {
            this.keys[key].classList.remove('correct', 'present', 'absent');
        });
        this.keyStates = {};
    }
}
