export interface SequenceSelection {
	start: number;  // 0-indexed inclusive
	end: number;    // 0-indexed inclusive
}

export function attachSelectionHandlers(
	sequenceContainer: HTMLElement,
	blockContainer: HTMLElement,
	sequence: string
): { cleanup: () => void } {
	let isSelecting = false;
	let selectionStart = -1;
	let currentSelection: SequenceSelection | null = null;
	let selectionBar: HTMLElement | null = null;

	function getResidueSpans(): HTMLElement[] {
		return Array.from(
			sequenceContainer.querySelectorAll<HTMLElement>(
				".biosequence-residue[data-pos]"
			)
		);
	}

	function clearSelection(): void {
		const spans = getResidueSpans();
		for (const span of spans) {
			span.removeClass("selected");
		}
		currentSelection = null;
		removeSelectionBar();
	}

	function removeSelectionBar(): void {
		if (selectionBar) {
			selectionBar.remove();
			selectionBar = null;
		}
	}

	function highlightRange(start: number, end: number): void {
		const spans = getResidueSpans();
		for (const span of spans) {
			const pos = parseInt(span.dataset.pos ?? "-1", 10);
			if (pos >= start && pos <= end) {
				span.addClass("selected");
			} else {
				span.removeClass("selected");
			}
		}
	}

	function showSelectionBar(sel: SequenceSelection): void {
		removeSelectionBar();
		const count = sel.end - sel.start + 1;

		selectionBar = createDiv({ cls: "biosequence-selection-bar" });

		selectionBar.createSpan({
			cls: "biosequence-selection-info",
			text: `Selected: pos ${sel.start + 1}\u2013${sel.end + 1} (${count} residue${count !== 1 ? "s" : ""})`,
		});

		const copyBtn = selectionBar.createEl("button", {
			cls: "biosequence-selection-copy",
			text: "Copy",
		});

		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const subseq = sequence.substring(sel.start, sel.end + 1);
			navigator.clipboard.writeText(subseq);
			copyBtn.textContent = "Copied!";
			setTimeout(() => {
				copyBtn.textContent = "Copy";
			}, 1500);
		});

		// Insert selection bar before the sequence container
		sequenceContainer.parentElement?.insertBefore(
			selectionBar,
			sequenceContainer
		);
	}

	function posFromEvent(e: MouseEvent): number | null {
		const target = e.target as HTMLElement;
		if (
			target.hasClass("biosequence-residue") &&
			target.dataset.pos !== undefined
		) {
			return parseInt(target.dataset.pos, 10);
		}
		return null;
	}

	function onMouseDown(e: MouseEvent): void {
		const pos = posFromEvent(e);
		if (pos === null) return;

		e.preventDefault();
		clearSelection();
		isSelecting = true;
		selectionStart = pos;
		highlightRange(pos, pos);
	}

	function onMouseMove(e: MouseEvent): void {
		if (!isSelecting) return;

		const pos = posFromEvent(e);
		if (pos === null) return;

		const rangeStart = Math.min(selectionStart, pos);
		const rangeEnd = Math.max(selectionStart, pos);
		highlightRange(rangeStart, rangeEnd);
	}

	function onMouseUp(e: MouseEvent): void {
		if (!isSelecting) return;
		isSelecting = false;

		const pos = posFromEvent(e);
		const endPos = pos !== null ? pos : selectionStart;

		const rangeStart = Math.min(selectionStart, endPos);
		const rangeEnd = Math.max(selectionStart, endPos);

		currentSelection = { start: rangeStart, end: rangeEnd };
		highlightRange(rangeStart, rangeEnd);
		showSelectionBar(currentSelection);
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (!currentSelection) return;
		if ((e.metaKey || e.ctrlKey) && e.key === "c") {
			e.preventDefault();
			const subseq = sequence.substring(
				currentSelection.start,
				currentSelection.end + 1
			);
			navigator.clipboard.writeText(subseq);
		}
	}

	function onClickOutside(e: MouseEvent): void {
		const target = e.target as HTMLElement;
		if (
			!sequenceContainer.contains(target) &&
			(!selectionBar || !selectionBar.contains(target))
		) {
			clearSelection();
		}
	}

	sequenceContainer.addEventListener("mousedown", onMouseDown);
	sequenceContainer.addEventListener("mousemove", onMouseMove);
	sequenceContainer.addEventListener("mouseup", onMouseUp);
	document.addEventListener("keydown", onKeyDown);
	document.addEventListener("mousedown", onClickOutside);

	function cleanup(): void {
		sequenceContainer.removeEventListener("mousedown", onMouseDown);
		sequenceContainer.removeEventListener("mousemove", onMouseMove);
		sequenceContainer.removeEventListener("mouseup", onMouseUp);
		document.removeEventListener("keydown", onKeyDown);
		document.removeEventListener("mousedown", onClickOutside);
		removeSelectionBar();
	}

	return { cleanup };
}
