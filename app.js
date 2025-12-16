/**
 * Factory Break Time Alert System
 * Main Application Logic
 * Updated: v1.3 - Auto Dismiss Alarm
 */

class AlarmManager {
    constructor() {
        this.breaks = this.loadBreaks();
        this.settings = this.loadSettings();

        // Audio State
        this.audioCtx = null;
        this.oscillator = null;
        this.isPlaying = false;
        this.alarmInterval = null;
        this.currentAudioElement = null; // For playing custom files
        this.autoDismissTimer = null; // Safety timer

        // Custom Sound Data (In-memory cache + simplified LocalStorage)
        this.customSounds = {
            start: null, // { name: filename, data: base64 }
            end: null
        };

        this.dom = {
            clock: document.getElementById('main-clock'),
            date: document.getElementById('main-date'),
            headerClock: document.getElementById('header-clock'),
            nextEventName: document.getElementById('next-event-name'),
            nextEventTime: document.getElementById('next-event-time'),
            countdown: document.getElementById('countdown'),
            statusBadge: document.getElementById('status-badge'),
            dayProgress: document.getElementById('day-progress'),
            progressText: document.getElementById('progress-text'),
            breakList: document.getElementById('break-list'),
            themeToggle: document.getElementById('theme-toggle'),
            sunIcon: document.getElementById('sun-icon'),
            moonIcon: document.getElementById('moon-icon'),
            alarmOverlay: document.getElementById('alarm-overlay'),
            markerContainer: document.getElementById('progress-markers'),
            // Inputs
            soundStartSelect: document.getElementById('sound-start-select'),
            soundEndSelect: document.getElementById('sound-end-select'),
            startCustomContainer: document.getElementById('start-custom-container'),
            endCustomContainer: document.getElementById('end-custom-container'),
            startFileInput: document.getElementById('start-file-input'),
            endFileInput: document.getElementById('end-file-input'),
            startFileName: document.getElementById('start-file-name'),
            endFileName: document.getElementById('end-file-name')
        };

        this.init();
    }

    // --- Initialization ---

    init() {
        this.loadCustomSounds(); // Load saved custom files
        this.requestNotificationPermission();
        this.renderBreaks();
        this.applyTheme();
        this.setupEventListeners();
        this.startClock();
        this.updateSystemStatus();

        // Handle Start Overlay
        const overlay = document.getElementById('init-overlay');
        const startBtn = document.getElementById('start-btn');

        const startApp = async () => {
            try {
                if (!this.audioCtx) {
                    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }
                this.playSilentUnlock();
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }
            } catch (e) {
                console.error("Audio Init Failed:", e);
                alert("Audio Init Failed. Please refresh.");
            }
        };

        if (startBtn) startBtn.onclick = startApp;
        else document.addEventListener('click', startApp, { once: true });

        // Initial UI Update for Sound Selects
        this.updateSoundUI('start');
        this.updateSoundUI('end');
    }

    loadCustomSounds() {
        try {
            const start = localStorage.getItem('factory_sound_custom_start');
            if (start) this.customSounds.start = JSON.parse(start);

            const end = localStorage.getItem('factory_sound_custom_end');
            if (end) this.customSounds.end = JSON.parse(end);
        } catch (e) {
            console.error("Failed to load custom sounds", e);
        }
    }

    playSilentUnlock() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    // --- Setup & Config ---

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    loadBreaks() {
        const stored = localStorage.getItem('factory_breaks');
        if (stored) return JSON.parse(stored);
        return [
            { id: 1, name: 'เบรคสาย (Morning Break)', start: '10:30', end: '11:00' },
            { id: 2, name: 'พักเที่ยง (Lunch)', start: '12:00', end: '13:00' },
            { id: 3, name: 'เบรคบ่าย (Afternoon Break)', start: '14:30', end: '15:00' }
        ];
    }

    loadSettings() {
        const stored = localStorage.getItem('factory_settings');
        if (stored) return JSON.parse(stored);
        return {
            theme: 'light',
            volume: 100,
            soundStart: 'bell',
            soundEnd: 'electronic',
            notify: true,
            autoFullscreen: false
        };
    }

    saveBreaks() {
        localStorage.setItem('factory_breaks', JSON.stringify(this.breaks));
        this.renderBreaks();
        this.updateSystemStatus();
    }

    saveSettings() {
        localStorage.setItem('factory_settings', JSON.stringify(this.settings));
        this.applyTheme();
    }

    // --- Core Logic ---

    startClock() {
        this.updateTime();
        this.timerInterval = setInterval(() => {
            this.updateTime();
            this.updateSystemStatus();
        }, 1000);
    }

    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
        const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        this.dom.clock.textContent = timeStr;
        this.dom.headerClock.textContent = timeStr;
        this.dom.date.textContent = dateStr;
    }

    updateSystemStatus() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = now.getSeconds();

        let activeBreak = null;
        let nextBreak = null;
        let minDiff = Infinity;

        this.breaks.forEach(b => {
            const start = this.parseTime(b.start);
            const end = this.parseTime(b.end);

            if (currentTime >= start && currentTime < end) {
                activeBreak = b;
            }
            if (start > currentTime) {
                const diff = start - currentTime;
                if (diff < minDiff) {
                    minDiff = diff;
                    nextBreak = b;
                }
            }
        });

        if (currentSeconds === 0) {
            this.checkAlarmTriggers(currentTime);
        }

        if (activeBreak) {
            this.setBreakMode(activeBreak);
        } else {
            this.setWorkMode(nextBreak);
        }
        this.updateProgressBar(currentTime);
    }

    checkAlarmTriggers(currentTime) {
        const triggerStart = this.breaks.find(b => this.parseTime(b.start) === currentTime);
        const triggerEnd = this.breaks.find(b => this.parseTime(b.end) === currentTime);

        if (triggerStart) this.triggerAlarm(triggerStart, 'start');
        else if (triggerEnd) this.triggerAlarm(triggerEnd, 'end');
    }

    setWorkMode(nextBreak) {
        if (this.currentStatus !== 'work') {
            this.currentStatus = 'work';
            this.updateThemeColors('work');
            this.dom.statusBadge.textContent = '🟢 เวลาทำงาน (Working Time)';
            this.dom.statusBadge.className = 'inline-block px-4 py-2 rounded-full text-base font-bold uppercase tracking-wider mb-8 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-sm transition-all duration-300';
            this.dom.nextEventName.parentElement.parentElement.classList.remove('border-red-500', 'border-4');
        }
        if (nextBreak) {
            this.dom.nextEventName.textContent = nextBreak.name;
            this.dom.nextEventTime.textContent = `${nextBreak.start} - ${nextBreak.end}`;
            const now = new Date();
            const start = this.parseTime(nextBreak.start);
            const target = new Date(now);
            target.setHours(Math.floor(start / 60), start % 60, 0, 0);
            const diff = target - now;
            this.dom.countdown.textContent = this.formatDuration(diff);
            this.dom.countdown.classList.remove('text-red-600');
        } else {
            this.dom.nextEventName.textContent = 'สิ้นสุดวันทำงาน';
            this.dom.nextEventTime.textContent = '-';
            this.dom.countdown.textContent = '--:--:--';
        }
    }

    setBreakMode(activeBreak) {
        if (this.currentStatus !== 'break') {
            this.currentStatus = 'break';
            this.updateThemeColors('break');
            this.dom.statusBadge.textContent = `🛑 กำลังพัก: ${activeBreak.name}`;
            this.dom.statusBadge.className = 'inline-block px-4 py-2 rounded-full text-base font-bold uppercase tracking-wider mb-8 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shadow-sm animate-pulse-soft';
        }
        this.dom.nextEventName.textContent = 'หมดเวลาพักใน (Time Remaining)';
        this.dom.nextEventTime.textContent = `สิ้นสุดเมื่อ ${activeBreak.end}`;
        const now = new Date();
        const end = this.parseTime(activeBreak.end);
        const target = new Date(now);
        target.setHours(Math.floor(end / 60), end % 60, 0, 0);
        const diff = target - now;
        this.dom.countdown.textContent = this.formatDuration(diff);
        this.dom.countdown.classList.add('text-red-600');
    }

    updateThemeColors(mode) {
        const bg = document.getElementById('status-bg');
        if (mode === 'work') {
            bg.classList.remove('bg-red-500', 'bg-yellow-500');
            bg.classList.add('bg-green-500');
        } else {
            bg.classList.remove('bg-green-500', 'bg-yellow-500');
            bg.classList.add('bg-red-500');
        }
    }

    updateProgressBar(currentMinute) {
        const startDay = 8 * 60;
        const endDay = 17 * 60;
        const total = endDay - startDay;
        let progress = 0;
        if (currentMinute > startDay) progress = ((currentMinute - startDay) / total) * 100;
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;
        this.dom.dayProgress.style.width = `${progress}%`;
        this.dom.progressText.textContent = `${Math.floor(progress)}% ของวันทำงาน`;
    }

    // --- Alarm & Audio Logic ---

    triggerAlarm(breakItem, type) {
        const title = type === 'start' ? `ได้เวลา ${breakItem.name}` : 'หมดเวลาพักแล้ว!';
        const subtitle = type === 'start' ? `เวลาพัก ${breakItem.start} - ${breakItem.end}` : 'กลับไปทำงานกันเถอะ';

        document.getElementById('alarm-title').textContent = title;
        document.getElementById('alarm-subtitle').textContent = subtitle;

        this.dom.alarmOverlay.classList.remove('hidden');
        this.dom.alarmOverlay.classList.add('flex');

        if (this.settings.autoFullscreen) this.toggleFullscreen(true);

        const soundType = type === 'start' ? this.settings.soundStart : this.settings.soundEnd;
        this.playAlarmSound(soundType, type, false);

        if (this.settings.notify && Notification.permission === 'granted') {
            new Notification(title, { body: subtitle, icon: 'https://cdn-icons-png.flaticon.com/512/3239/3239952.png' });
        }
    }

    dismissAlarm() {
        this.dom.alarmOverlay.classList.add('hidden');
        this.stopSound();
    }

    async playAlarmSound(soundKey, contextType, loop = false) {
        this.stopSound();
        this.isPlaying = true;

        const vol = (this.settings.volume / 100);

        // Check if custom
        if (soundKey === 'custom') {
            const data = this.customSounds[contextType];
            if (data && data.data) {
                console.log("Playing custom file:", data.name);
                const audio = new Audio(data.data);
                audio.volume = vol;
                audio.play().catch(e => console.error("Audio play error", e));

                this.currentAudioElement = audio;

                audio.onended = () => {
                    this.isPlaying = false;
                    this.currentAudioElement = null;
                    console.log("Custom sound finished, dismissing alarm.");
                    // AUTO DISMISS HERE
                    this.dismissAlarm();
                };
                return;
            } else {
                console.warn("No custom file found, fallback to bell");
                soundKey = 'bell';
            }
        }

        // Ensure Context for configured sounds
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

        const shouldLoop = true;

        switch (soundKey) {
            case 'bell': this.playSoundBell(vol, shouldLoop); break;
            case 'electronic': this.playSoundElectronic(vol, shouldLoop); break;
            case 'warning': this.playSoundSiren(vol, shouldLoop); break;
            case 'melody': this.playSoundMelody(vol, shouldLoop); break;
            default: this.playSoundBell(vol, shouldLoop);
        }

        // Safety timeout for looped sounds (e.g., dismiss after 2 minutes if ignored)
        // Only if it's a real alarm (not test) - playAlarmSound is reused for test
        // Ideally we distinguish test vs real, but here we can just set it. 
        // If testing, user will click elsewhere or it stops.
        if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = setTimeout(() => {
            if (this.isPlaying && soundKey !== 'custom') { // Custom handles itself
                this.dismissAlarm();
            }
        }, 60000); // 1 minute timeout for default sounds
    }

    stopSound() {
        this.isPlaying = false;
        // Stop synthesized
        if (this.oscillator) {
            try { this.oscillator.stop(); } catch (e) { }
            this.oscillator = null;
        }
        if (this.alarmInterval) {
            clearInterval(this.alarmInterval);
            this.alarmInterval = null;
        }
        // Stop audio element
        if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement.currentTime = 0;
            this.currentAudioElement = null;
        }
        if (this.autoDismissTimer) {
            clearTimeout(this.autoDismissTimer);
            this.autoDismissTimer = null;
        }
    }

    // --- File Input Handling ---

    handleFileUpload(file, type) {
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            alert('File size too large! Please choose a file smaller than 3MB for browser storage.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            const data = { name: file.name, data: base64 };
            this.customSounds[type] = data;
            try {
                localStorage.setItem(`factory_sound_custom_${type}`, JSON.stringify(data));
                this.updateSoundUI(type);
                alert(`Saved custom sound for ${type === 'start' ? 'Break Start' : 'Break End'}!`);
            } catch (err) {
                console.error("Storage failed", err);
                alert('Storage full! Custom sound sounds will work for this session but may not persist. Try a smaller file.');
            }
        };
        reader.readAsDataURL(file);
    }

    updateSoundUI(type) {
        const select = type === 'start' ? this.dom.soundStartSelect : this.dom.soundEndSelect;
        const container = type === 'start' ? this.dom.startCustomContainer : this.dom.endCustomContainer;
        const nameDisplay = type === 'start' ? this.dom.startFileName : this.dom.endFileName;

        if (select.value === 'custom') {
            container.classList.remove('hidden');
            const saved = this.customSounds[type];
            if (saved) {
                nameDisplay.textContent = `File: ${saved.name}`;
                nameDisplay.classList.remove('hidden');
            } else {
                nameDisplay.classList.add('hidden');
            }
        } else {
            container.classList.add('hidden');
        }
    }

    // --- Event Listeners ---

    setupEventListeners() {
        this.dom.themeToggle.onclick = () => {
            this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
            this.saveSettings();
        };
        document.getElementById('fullscreen-btn').onclick = () => this.toggleFullscreen();

        const panel = document.getElementById('settings-panel');
        const overlay = document.getElementById('sidebar-overlay');
        const openSettings = () => {
            panel.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        };
        const closeSettings = () => {
            panel.classList.add('translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        };

        document.getElementById('settings-btn').onclick = openSettings;
        document.getElementById('close-settings').onclick = closeSettings;
        overlay.onclick = closeSettings;

        document.getElementById('add-break-btn').onclick = () => this.openAddModal();
        document.getElementById('modal-cancel').onclick = () => this.closeModal();
        document.getElementById('modal-backdrop').onclick = () => this.closeModal();

        document.getElementById('break-form').onsubmit = (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const data = {
                name: document.getElementById('break-name-input').value,
                start: document.getElementById('break-start-input').value,
                end: document.getElementById('break-end-input').value
            };
            if (id) this.updateBreak(id, data);
            else this.addBreak(data);
            this.closeModal();
        };

        document.getElementById('dismiss-alarm').onclick = () => this.dismissAlarm();

        // Sound Settings
        document.getElementById('volume-slider').oninput = (e) => {
            this.settings.volume = e.target.value;
            document.getElementById('volume-val').textContent = `${e.target.value}%`;
            this.saveSettings();
        };

        this.dom.soundStartSelect.onchange = (e) => {
            this.settings.soundStart = e.target.value;
            this.saveSettings();
            this.updateSoundUI('start');
        };
        this.dom.soundEndSelect.onchange = (e) => {
            this.settings.soundEnd = e.target.value;
            this.saveSettings();
            this.updateSoundUI('end');
        };

        // File Inputs
        this.dom.startFileInput.onchange = (e) => this.handleFileUpload(e.target.files[0], 'start');
        this.dom.endFileInput.onchange = (e) => this.handleFileUpload(e.target.files[0], 'end');

        // Tests
        document.getElementById('test-start-sound').onclick = () => this.playAlarmSound(this.settings.soundStart, 'start');
        document.getElementById('test-end-sound').onclick = () => this.playAlarmSound(this.settings.soundEnd, 'end');

        document.getElementById('notify-toggle').onchange = (e) => {
            this.settings.notify = e.target.checked;
            this.requestNotificationPermission();
            this.saveSettings();
        };
        document.getElementById('auto-fullscreen').onchange = (e) => {
            this.settings.autoFullscreen = e.target.checked;
            this.saveSettings();
        };
        document.getElementById('reset-data').onclick = () => {
            if (confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น?')) {
                localStorage.clear();
                location.reload();
            }
        };
    }

    // --- Synthesized Sounds (Unchanged) ---
    playSoundBell(vol, loop) {
        const playOne = () => {
            if (!this.isPlaying) return;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 1.5);
        };
        playOne();
        if (loop) this.alarmInterval = setInterval(playOne, 2000);
    }
    playSoundElectronic(vol, loop) {
        const playOne = () => {
            if (!this.isPlaying) return;
            const now = this.audioCtx.currentTime;
            const beep = (t, freq) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = freq;
                gain.gain.value = vol * 0.5;
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.1);
            };
            beep(now, 1000);
            beep(now + 0.2, 1000);
            beep(now + 0.4, 1000);
        };
        playOne();
        if (loop) this.alarmInterval = setInterval(playOne, 1500);
    }
    playSoundSiren(vol, loop) {
        const playOne = () => {
            if (!this.isPlaying) return;
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.5);
            osc.frequency.linearRampToValueAtTime(600, now + 1.0);
            gain.gain.value = vol * 0.3;
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(now + 1);
        };
        playOne();
        if (loop) this.alarmInterval = setInterval(playOne, 1100);
    }
    playSoundMelody(vol, loop) {
        const playOne = () => {
            if (!this.isPlaying) return;
            const now = this.audioCtx.currentTime;
            const note = (freq, t, dur) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(vol, t);
                gain.gain.linearRampToValueAtTime(0, t + dur);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(t);
                osc.stop(t + dur);
            };
            note(660, now, 0.4);
            note(550, now + 0.5, 0.6);
        };
        playOne();
        if (loop) this.alarmInterval = setInterval(playOne, 2000);
    }

    // --- Utilities (Unchanged) ---
    applyTheme() {
        if (this.settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
            this.dom.sunIcon.classList.remove('hidden');
            this.dom.moonIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            this.dom.sunIcon.classList.add('hidden');
            this.dom.moonIcon.classList.remove('hidden');
        }
        document.getElementById('volume-slider').value = this.settings.volume;
        document.getElementById('volume-val').textContent = `${this.settings.volume}%`;
        document.getElementById('sound-start-select').value = this.settings.soundStart;
        document.getElementById('sound-end-select').value = this.settings.soundEnd;
        document.getElementById('notify-toggle').checked = this.settings.notify;
        document.getElementById('auto-fullscreen').checked = this.settings.autoFullscreen;
    }
    toggleFullscreen(force = false) {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
        else if (!force) document.exitFullscreen();
    }
    renderBreaks() {
        this.dom.breakList.innerHTML = '';
        this.dom.markerContainer.innerHTML = '';
        const startDay = 8 * 60;
        const endDay = 17 * 60;
        const total = endDay - startDay;
        this.breaks.sort((a, b) => this.parseTime(a.start) - this.parseTime(b.start));
        const template = document.getElementById('break-item-template');
        this.breaks.forEach(b => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.break-name').textContent = b.name;
            clone.querySelector('.break-start').textContent = b.start;
            clone.querySelector('.break-end').textContent = b.end;
            clone.querySelector('.edit-btn').onclick = () => this.openEditModal(b);
            clone.querySelector('.delete-btn').onclick = () => this.deleteBreak(b.id);
            this.dom.breakList.appendChild(clone);
            const startTime = this.parseTime(b.start);
            if (startTime >= startDay && startTime <= endDay) {
                const pos = ((startTime - startDay) / total) * 100;
                const marker = document.createElement('div');
                marker.className = 'absolute top-0 bottom-0 w-1 bg-white/50 hover:bg-white cursor-help transition-colors';
                marker.style.left = `${pos}%`;
                marker.title = `${b.name} (${b.start})`;
                this.dom.markerContainer.appendChild(marker);
            }
        });
    }
    addBreak(breakData) {
        this.breaks.push({ id: Date.now(), ...breakData });
        this.saveBreaks();
    }
    updateBreak(id, breakData) {
        const index = this.breaks.findIndex(b => b.id == id);
        if (index > -1) { this.breaks[index] = { ...this.breaks[index], ...breakData }; this.saveBreaks(); }
    }
    deleteBreak(id) {
        if (confirm('ต้องการลบช่วงเวลานี้ใช่หรือไม่?')) { this.breaks = this.breaks.filter(b => b.id != id); this.saveBreaks(); }
    }
    openAddModal() {
        document.getElementById('modal-title').textContent = 'เพิ่มช่วงเวลาพัก';
        document.getElementById('edit-id').value = '';
        this.showModal();
    }
    openEditModal(breakItem) {
        document.getElementById('modal-title').textContent = 'แก้ไขช่วงเวลาพัก';
        document.getElementById('edit-id').value = breakItem.id;
        document.getElementById('break-name-input').value = breakItem.name;
        document.getElementById('break-start-input').value = breakItem.start;
        document.getElementById('break-end-input').value = breakItem.end;
        this.showModal();
    }
    showModal() {
        const modal = document.getElementById('break-modal');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');
        setTimeout(() => { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10);
    }
    closeModal() {
        const modal = document.getElementById('break-modal');
        const content = document.getElementById('modal-content');
        content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
    parseTime(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
    formatDuration(ms) {
        if (ms < 0) return '00:00:00';
        const sec = Math.floor((ms / 1000) % 60);
        const min = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));
        return `${String(hours).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new AlarmManager(); });
