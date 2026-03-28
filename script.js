document.addEventListener('DOMContentLoaded', function () {
	const turnButtons = document.querySelectorAll('.turn');

	// No automatic speech: user requested speech disabled.
	// Buttons navigate when they have a `data-target` attribute.
	turnButtons.forEach(btn => {
		btn.addEventListener('click', function () {
			const target = btn.getAttribute('data-target');
			if (target) {
				window.location.href = target;
				return;
			}

			// Fallback: if no target, try history back for "back" buttons
			if (btn.classList.contains('back')) {
				if (window.history.length > 1) window.history.back();
			}
		});
	});

	// Audio toggle on standalone pages
	const audio = document.getElementById('bg-audio');
	const audioToggle = document.querySelector('.audio-toggle');
	if (audio && audioToggle) {
		// ensure preload is none; user must opt-in
		audioToggle.addEventListener('click', function () {
			if (audio.paused) {
				// start
				audio.play().then(() => {
					audioToggle.classList.add('playing');
					audioToggle.setAttribute('aria-pressed', 'true');
					audioToggle.setAttribute('aria-label', 'Pause audio');
				}).catch(() => {
					// play rejected (autoplay policy). still toggle UI so user can try again
					audioToggle.classList.add('playing');
					audioToggle.setAttribute('aria-pressed', 'true');
					audioToggle.setAttribute('aria-label', 'Pause audio');
				});
			} else {
				audio.pause();
				audioToggle.classList.remove('playing');
				audioToggle.setAttribute('aria-pressed', 'false');
				audioToggle.setAttribute('aria-label', 'Play audio');
			}
		});

		// Sync button when audio ends
		audio.addEventListener('ended', function () {
			audioToggle.classList.remove('playing');
			audioToggle.setAttribute('aria-pressed', 'false');
			audioToggle.setAttribute('aria-label', 'Play audio');
		});
	}
});