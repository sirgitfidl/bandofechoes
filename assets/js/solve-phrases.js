// Puzzle solve phrases (separate module)
// Edit / add phrases here. They will be picked up by collage-puzzle.js when the puzzle is solved.
(function () {
    const phrases = [
        'Look at you, skulking behind that screen.',
        'Puzzled? Sure. Amused? Hardly.',
        'Well, well… what have we here?',
        'Did you think no one would notice?',
        'Curiosity isn\'t always flattering, you know.',
        'You really shouldn\'t be here.',
        'Looking for something?',
        'Bold of you to wander this far.',
        'This isn\'t on the tour.',
        'Not lost. Just… somewhere you shouldn\'t be.',
        'Oh, you\'re one of THOSE visitors.',
        'Psst… pretend you never saw this.',
        'Turn back now.'
    ];
    if (!Array.isArray(window.PUZZLE_SOLVE_PHRASES) || !window.PUZZLE_SOLVE_PHRASES.length) {
        window.PUZZLE_SOLVE_PHRASES = phrases.slice();
    }
})();
