/**
 * Creates a temporary DOM probe element to measure the actual rendered width
 * of a single residue span, including CSS margins. This avoids hardcoding
 * pixel widths that break at different font sizes or DPI settings.
 */
function measureResidueWidth(container: HTMLElement, fontSize: number): number {
	const wrapper = document.createElement("div");
	wrapper.className = "biosequence-sequence";
	wrapper.style.cssText =
		`font-size: ${fontSize}px; position: absolute; visibility: hidden; ` +
		`pointer-events: none; height: 0; overflow: hidden;`;

	const residuesSpan = document.createElement("span");
	residuesSpan.className = "biosequence-residues";

	const residue = document.createElement("span");
	residue.className = "biosequence-residue";
	residue.textContent = "W";

	residuesSpan.appendChild(residue);
	wrapper.appendChild(residuesSpan);
	container.appendChild(wrapper);

	const rect = residue.getBoundingClientRect();
	const style = getComputedStyle(residue);
	const marginLeft = parseFloat(style.marginLeft) || 0;
	const marginRight = parseFloat(style.marginRight) || 0;
	const totalWidth = rect.width + marginLeft + marginRight;

	container.removeChild(wrapper);

	// Fallback to the old heuristic if measurement failed
	if (totalWidth <= 0) {
		return fontSize * 1.2 + 1;
	}
	return totalWidth;
}

/**
 * Creates a temporary DOM probe to measure the rendered width of the gutter
 * element (line-number column), matching production CSS classes.
 */
function measureGutterWidth(container: HTMLElement, fontSize: number): number {
	const wrapper = document.createElement("div");
	wrapper.className = "biosequence-sequence";
	wrapper.style.cssText =
		`font-size: ${fontSize}px; position: absolute; visibility: hidden; ` +
		`pointer-events: none; height: 0; overflow: hidden;`;

	const gutter = document.createElement("span");
	gutter.className = "biosequence-gutter";
	gutter.textContent = "99999";

	wrapper.appendChild(gutter);
	container.appendChild(wrapper);

	const width = gutter.getBoundingClientRect().width;

	container.removeChild(wrapper);

	// Fallback to the old heuristic if measurement failed
	if (width <= 0) {
		return 5 * 0.8 * fontSize + 10;
	}
	return width;
}

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

	// Measure actual rendered widths from the DOM once
	const measuredResidueWidth = measureResidueWidth(container, fontSize);
	const measuredGutterWidth = measureGutterWidth(container, fontSize);

	let lastWidth = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function computeResiduesPerLine(containerWidth: number): number {
		let availableWidth = containerWidth;

		if (gutterActive) {
			availableWidth -= measuredGutterWidth;
		}

		// Account for container padding (16px each side)
		availableWidth -= 32;

		// Subtract extra offset (e.g. alignment label width)
		availableWidth -= extraOffsetPx;

		if (availableWidth <= 0) {
			return 10;
		}

		const computed = Math.floor(availableWidth / measuredResidueWidth);

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
	// Measure actual rendered widths from the DOM
	const measuredResidueWidth = measureResidueWidth(container, fontSize);
	const measuredGutterWidth = measureGutterWidth(container, fontSize);

	let availableWidth = container.clientWidth;

	if (gutterActive) {
		availableWidth -= measuredGutterWidth;
	}

	// Account for container padding
	availableWidth -= 32;

	// Subtract extra offset (e.g. alignment label width)
	availableWidth -= extraOffsetPx;

	if (availableWidth <= 0) {
		return maxPerLine;
	}

	const computed = Math.floor(availableWidth / measuredResidueWidth);

	return Math.max(10, Math.min(computed, maxPerLine));
}
