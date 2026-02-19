/**
 * Formula-based reflow manager.
 *
 * Residue width  = fontSize * 1.2  (margin is 0, so no +1 correction)
 * Gutter width   = 5 * 0.8 * fontSize + 10  (5em at 0.8em font-size + 10px padding)
 */

/**
 * Creates a ResizeObserver that monitors the container width and computes
 * the optimal number of residues per line, triggering a reflow callback.
 */
export function createReflowObserver(
	container: HTMLElement,
	gutterActive: boolean,
	fontSize: number,
	maxPerLine: number,
	onReflow: (residuesPerLine: number) => void,
	extraOffsetPx: number = 0
): ResizeObserver {
	const DEBOUNCE_MS = 150;
	const THRESHOLD_PX = 5;

	const residueWidth = fontSize * 1.2;
	const gutterWidth = 5 * 0.8 * fontSize + 10;

	let lastWidth = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function computeResiduesPerLine(containerWidth: number): number {
		let availableWidth = containerWidth;

		if (gutterActive) {
			// Subtract both left and right gutters
			availableWidth -= gutterWidth * 2;
		}

		// Account for container padding (16px each side)
		availableWidth -= 32;

		// Subtract extra offset (e.g. alignment label width)
		availableWidth -= extraOffsetPx;

		if (availableWidth <= 0) {
			return 10;
		}

		const computed = Math.floor(availableWidth / residueWidth);

		// Clamp between 10 and maxPerLine
		return Math.max(10, Math.min(computed, maxPerLine));
	}

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const width = entry.contentRect.width;

			// Ignore sub-pixel changes
			if (Math.abs(width - lastWidth) < THRESHOLD_PX) {
				continue;
			}

			lastWidth = width;

			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
			}

			debounceTimer = setTimeout(() => {
				const residuesPerLine = computeResiduesPerLine(width);
				onReflow(residuesPerLine);
				debounceTimer = null;
			}, DEBOUNCE_MS);
		}
	});

	observer.observe(container);
	return observer;
}

/**
 * Compute the initial residues-per-line from current container dimensions.
 */
export function computeInitialResiduesPerLine(
	container: HTMLElement,
	gutterActive: boolean,
	fontSize: number,
	maxPerLine: number,
	extraOffsetPx: number = 0
): number {
	const residueWidth = fontSize * 1.2;
	const gutterWidth = 5 * 0.8 * fontSize + 10;

	let availableWidth = container.clientWidth;

	if (gutterActive) {
		// Subtract both left and right gutters
		availableWidth -= gutterWidth * 2;
	}

	// Account for container padding
	availableWidth -= 32;

	// Subtract extra offset (e.g. alignment label width)
	availableWidth -= extraOffsetPx;

	if (availableWidth <= 0) {
		return maxPerLine;
	}

	const computed = Math.floor(availableWidth / residueWidth);

	return Math.max(10, Math.min(computed, maxPerLine));
}
