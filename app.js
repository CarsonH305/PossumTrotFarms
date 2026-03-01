(function () {
  'use strict';

  var config = window.POSSUM_TROT_CONFIG || {};
  var supabase = null;
  if (config.supabaseUrl && config.supabaseAnonKey) {
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  var VENDOR_CATEGORIES = ['plumbing', 'electrical', 'gas', 'roof', 'other'];

  var PLACEHOLDER_VENDORS = [
    { category: 'plumbing', name: 'Greenbrier Plumbing Co.', contact_name: 'Mike Robertson', phone: '(615) 555-0101', email: 'service@greenbrierplumbing.example.com', notes: null },
    { category: 'plumbing', name: 'Robertson & Sons', contact_name: 'Dave Robertson', phone: '(615) 555-0102', email: null, notes: null },
    { category: 'electrical', name: 'Middle Tennessee Electric', contact_name: 'Sarah Chen', phone: '(615) 555-0201', email: 'info@mtelectric.example.com', notes: null },
    { category: 'electrical', name: 'SafeWire LLC', contact_name: 'James Holt', phone: '(615) 555-0202', email: null, notes: null },
    { category: 'gas', name: 'Sumner County Propane', contact_name: 'Office', phone: '(615) 555-0301', email: null, notes: null },
    { category: 'roof', name: 'Tri-Star Roofing', contact_name: 'Tom Bradley', phone: '(615) 555-0401', email: 'jobs@tristarroof.example.com', notes: null },
    { category: 'roof', name: 'Heritage Roof & Gutter', contact_name: 'Lisa Park', phone: '(615) 555-0402', email: null, notes: null },
    { category: 'other', name: 'Greenbrier General Store', contact_name: 'Front desk', phone: '(615) 555-0501', email: null, notes: null }
  ];

  function showMessage(containerId, text, type) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var existing = container.querySelector('.message');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'message ' + (type || 'info');
    el.textContent = text;
    container.insertBefore(el, container.firstChild);
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 5000);
  }

  var BOOKINGS_STORAGE_KEY = 'possumtrot-bookings';

  function getBookings(cb) {
    if (supabase) {
      supabase.from('bookings').select('id, start_date, end_date, who, is_yearly, created_at').order('start_date').then(function (res) {
        cb(res.error ? [] : (res.data || []));
      });
      return;
    }
    try {
      var raw = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      cb(raw ? JSON.parse(raw) : []);
    } catch (e) {
      cb([]);
    }
  }

  function saveBookingToLocal(start_date, end_date, who, is_yearly) {
    try {
      var list = [];
      var raw = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (raw) list = JSON.parse(raw);
      list.push({
        id: 'local-' + Date.now(),
        start_date: start_date,
        end_date: end_date,
        who: who || null,
        is_yearly: is_yearly,
        created_at: new Date().toISOString()
      });
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function expandYearlyBookings(bookings, yearStart, yearEnd) {
    var expanded = [];
    var y;
    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      var createdAt = b.created_at || null;
      if (!b.is_yearly) {
        expanded.push({ start_date: b.start_date, end_date: b.end_date, who: b.who || 'Stay', created_at: createdAt });
        continue;
      }
      var start = new Date(b.start_date);
      var end = new Date(b.end_date);
      for (y = yearStart; y <= yearEnd; y++) {
        var endYear = end.getFullYear() === start.getFullYear() ? y : y + 1;
        var ms = new Date(start.getMonth(), start.getDate(), y).getTime();
        var me = new Date(end.getMonth(), end.getDate(), end.getFullYear() === start.getFullYear() ? y : endYear).getTime();
        expanded.push({
          start_date: formatDateYMD(new Date(ms)),
          end_date: formatDateYMD(new Date(me)),
          who: b.who || 'Stay',
          created_at: createdAt
        });
      }
    }
    return expanded;
  }

  function formatDateYMD(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function formatDateLong(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var yy = String(d.getFullYear()).slice(-2);
    return months[d.getMonth()] + ' ' + d.getDate() + ', \'' + yy;
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return formatDateLong(iso) + ' at ' + t;
  }

  var calendarYear = new Date().getFullYear();
  var calendarMonth = new Date().getMonth();
  var currentBookings = [];
  var currentExpanded = [];
  var currentMeetings = [];

  function getMeetings(cb) {
    if (!supabase) {
      cb([]);
      return;
    }
    supabase.from('meetings').select('*').order('meeting_date').then(function (res) {
      cb(res.error ? [] : (res.data || []));
    });
  }

  function renderCalendar(bookings, meetings, year, month) {
    currentBookings = bookings;
    currentMeetings = meetings || [];
    var yearStart = year - 1;
    var yearEnd = year + 1;
    currentExpanded = expandYearlyBookings(bookings, yearStart, yearEnd);

    var wrap = document.getElementById('calendar-wrap');
    if (!wrap) return;

    var titleEl = document.getElementById('calendar-month-title');
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (titleEl) titleEl.textContent = monthNames[month] + ' \'' + String(year).slice(-2);

    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startWeekday = firstDay.getDay();
    var daysInMonth = lastDay.getDate();

    var grid = document.createElement('div');
    grid.className = 'calendar-grid';

    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'calendar-day-header';
      h.textContent = d;
      grid.appendChild(h);
    });
    var empty = startWeekday % 7;
    for (var i = 0; i < empty; i++) {
      var emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day';
      emptyCell.setAttribute('aria-hidden', 'true');
      grid.appendChild(emptyCell);
    }
    var todayY = new Date().getFullYear();
    var todayM = String(new Date().getMonth() + 1).padStart(2, '0');
    var todayD = String(new Date().getDate()).padStart(2, '0');
    var todayStr = todayY + '-' + todayM + '-' + todayD;
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isPast = dateStr < todayStr;
      var isBooked = currentExpanded.some(function (b) {
        return dateStr >= b.start_date && dateStr <= b.end_date;
      });
      var hasMeeting = currentMeetings.some(function (m) { return m.meeting_date === dateStr; });
      var cell = document.createElement('div');
      cell.className = 'calendar-day' + (isBooked ? ' booked' : '') + (hasMeeting ? ' has-meeting' : '') + (isPast ? ' past' : '');
      cell.setAttribute('data-date', dateStr);
      if (!isPast) {
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');
      } else {
        cell.setAttribute('aria-disabled', 'true');
      }
      var dayNum = document.createElement('span');
      dayNum.className = 'day-num';
      dayNum.textContent = d;
      cell.appendChild(dayNum);
      grid.appendChild(cell);
      if (!isPast) {
        cell.addEventListener('click', function (ev) {
          openDateDetail(ev.currentTarget.getAttribute('data-date'));
        });
        cell.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openDateDetail(ev.currentTarget.getAttribute('data-date'));
          }
        });
      }
      cell.addEventListener('mouseenter', function (ev) {
        var hoverDateStr = ev.currentTarget.getAttribute('data-date');
        var whoOnDate = currentExpanded.filter(function (b) {
          return hoverDateStr >= b.start_date && hoverDateStr <= b.end_date;
        }).map(function (b) { return b.who || 'Stay'; });
        var meetingsOnDate = currentMeetings.filter(function (m) { return m.meeting_date === hoverDateStr; });
        var tip = document.getElementById('calendar-day-tooltip');
        if (!tip) return;
        var parts = [];
        if (whoOnDate.length) parts.push('Stays: ' + whoOnDate.join(', '));
        if (meetingsOnDate.length) parts.push('Meetings: ' + meetingsOnDate.map(function (m) { return m.title || 'Meeting'; }).join(', '));
        tip.textContent = parts.length ? parts.join(' · ') : 'No one';
        tip.setAttribute('aria-hidden', 'false');
        tip.classList.add('is-visible');
        var rect = ev.currentTarget.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top - 6;
        var tipW = tip.offsetWidth;
        var tipH = tip.offsetHeight;
        tip.style.left = Math.max(8, Math.min(x - tipW / 2, window.innerWidth - tipW - 8)) + 'px';
        tip.style.top = Math.max(8, Math.min(y - tipH, window.innerHeight - tipH - 8)) + 'px';
      });
      cell.addEventListener('mouseleave', function () {
        var tip = document.getElementById('calendar-day-tooltip');
        if (tip) {
          tip.classList.remove('is-visible');
          tip.setAttribute('aria-hidden', 'true');
        }
      });
    }
    wrap.innerHTML = '';
    wrap.appendChild(grid);

    renderStaysStrip(year, month, currentExpanded, daysInMonth);
    renderMeetingsThisMonth(year, month, currentMeetings);
  }

  function getStaysInMonth(expanded, year, month) {
    var monthStart = year + '-' + String(month + 1).padStart(2, '0') + '-01';
    var lastDay = new Date(year, month + 1, 0).getDate();
    var monthEnd = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    return expanded.filter(function (b) {
      return b.end_date >= monthStart && b.start_date <= monthEnd;
    });
  }

  function renderStaysStrip(year, month, expanded, daysInMonth) {
    var container = document.getElementById('calendar-stays');
    if (!container) return;
    var stays = getStaysInMonth(expanded, year, month);
    container.innerHTML = '';
    if (stays.length === 0) {
      container.innerHTML = '<p class="calendar-stays-title">No stays this month</p>';
      return;
    }
    var title = document.createElement('p');
    title.className = 'calendar-stays-title';
    title.textContent = 'Stays this month';
    container.appendChild(title);
    stays.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'stay-row';
      var who = document.createElement('div');
      who.className = 'stay-who';
      who.textContent = b.who || 'Stay';
      row.appendChild(who);
      var barWrap = document.createElement('div');
      barWrap.className = 'stay-bar-wrap';
      var track = document.createElement('div');
      track.className = 'stay-bar-track';
      var startDay = parseInt(b.start_date.slice(8, 10), 10);
      var endDay = parseInt(b.end_date.slice(8, 10), 10);
      var startMonth = parseInt(b.start_date.slice(5, 7), 10);
      var endMonth = parseInt(b.end_date.slice(5, 7), 10);
      var rangeStart = startMonth === month + 1 ? startDay : 1;
      var rangeEnd = endMonth === month + 1 ? endDay : daysInMonth;
      for (var i = 1; i <= daysInMonth; i++) {
        var cell = document.createElement('div');
        cell.className = 'day-cell' + (i >= rangeStart && i <= rangeEnd ? ' filled' : '');
        track.appendChild(cell);
      }
      barWrap.appendChild(track);
      row.appendChild(barWrap);
      container.appendChild(row);
    });
  }

  function getMeetingsInMonth(meetings, year, month) {
    var monthStart = year + '-' + String(month + 1).padStart(2, '0') + '-01';
    var lastDay = new Date(year, month + 1, 0).getDate();
    var monthEnd = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    return (meetings || []).filter(function (m) {
      return m.meeting_date >= monthStart && m.meeting_date <= monthEnd;
    }).sort(function (a, b) { return a.meeting_date.localeCompare(b.meeting_date); });
  }

  function renderMeetingsThisMonth(year, month, meetings) {
    var container = document.getElementById('calendar-meetings');
    if (!container) return;
    var list = getMeetingsInMonth(meetings, year, month);
    container.innerHTML = '';
    var title = document.createElement('p');
    title.className = 'calendar-meetings-title';
    title.textContent = list.length === 0 ? 'No meetings this month' : 'Meetings this month';
    container.appendChild(title);
    if (list.length > 0) {
      var ul = document.createElement('ul');
      ul.className = 'calendar-meetings-list';
      list.forEach(function (m) {
        var li = document.createElement('li');
        var dateLabel = document.createElement('div');
        dateLabel.className = 'meeting-row-date';
        dateLabel.textContent = formatDateLong(m.meeting_date);
        li.appendChild(dateLabel);
        var titleLink = document.createElement('div');
        titleLink.className = 'meeting-row-title';
        titleLink.textContent = m.title || 'Meeting';
        titleLink.setAttribute('role', 'button');
        titleLink.setAttribute('tabindex', '0');
        li.appendChild(titleLink);
        titleLink.addEventListener('click', function () { openMeetingDetail(m); });
        titleLink.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openMeetingDetail(m); }
        });
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }
  }

  function openDateDetail(dateStr) {
    var list = currentExpanded.filter(function (b) {
      return dateStr >= b.start_date && dateStr <= b.end_date;
    });
    var meetingsOnDate = currentMeetings.filter(function (m) { return m.meeting_date === dateStr; });
    var titleEl = document.getElementById('date-detail-modal-title');
    var bodyEl = document.getElementById('date-detail-body');
    var modal = document.getElementById('date-detail-modal');
    if (!titleEl || !bodyEl || !modal) return;
    var d = new Date(dateStr);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var yy = String(d.getFullYear()).slice(-2);
    titleEl.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', \'' + yy;
    var frag = document.createDocumentFragment();
    if (list.length > 0) {
      var stayHeading = document.createElement('p');
      stayHeading.className = 'date-detail-meta';
      stayHeading.style.marginTop = '0';
      stayHeading.textContent = 'Stays';
      frag.appendChild(stayHeading);
      var ul = document.createElement('ul');
      ul.className = 'date-detail-list';
      list.forEach(function (b) {
        var li = document.createElement('li');
        var who = document.createElement('div');
        who.className = 'date-detail-who';
        who.textContent = b.who || 'Stay';
        li.appendChild(who);
        if (b.created_at) {
          var meta = document.createElement('div');
          meta.className = 'date-detail-meta';
          meta.textContent = 'Booked on ' + formatDateTime(b.created_at);
          li.appendChild(meta);
        }
        ul.appendChild(li);
      });
      frag.appendChild(ul);
    }
    if (meetingsOnDate.length > 0) {
      var meetHeading = document.createElement('p');
      meetHeading.className = 'date-detail-meta';
      meetHeading.style.marginTop = list.length ? '1rem' : '0';
      meetHeading.textContent = 'Meetings';
      frag.appendChild(meetHeading);
      var meetUl = document.createElement('ul');
      meetUl.className = 'date-detail-list';
      meetingsOnDate.forEach(function (m) {
        var li = document.createElement('li');
        var who = document.createElement('div');
        who.className = 'date-detail-who';
        who.textContent = m.title || 'Meeting';
        who.style.cursor = 'pointer';
        who.style.color = 'var(--meeting)';
        li.appendChild(who);
        who.addEventListener('click', function () {
          closeDateDetail();
          openMeetingDetail(m);
        });
        meetUl.appendChild(li);
      });
      frag.appendChild(meetUl);
    }
    if (list.length === 0 && meetingsOnDate.length === 0) {
      var p = document.createElement('p');
      p.className = 'date-detail-meta';
      p.textContent = 'No one booked and no meetings this date.';
      frag.appendChild(p);
    }
    var actionsWrap = document.createElement('div');
    actionsWrap.className = 'date-detail-actions';
    var addStayBtn = document.createElement('button');
    addStayBtn.type = 'button';
    addStayBtn.className = 'btn btn-primary date-detail-add-stay-btn';
    addStayBtn.setAttribute('data-date', dateStr);
    addStayBtn.textContent = 'Add Stay';
    addStayBtn.addEventListener('click', function () {
      closeDateDetail();
      openAddStayModalWithStartDate(dateStr);
    });
    actionsWrap.appendChild(addStayBtn);
    var addMeetingBtn = document.createElement('button');
    addMeetingBtn.type = 'button';
    addMeetingBtn.className = 'btn btn-meeting date-detail-add-meeting-btn';
    addMeetingBtn.setAttribute('data-date', dateStr);
    addMeetingBtn.textContent = 'Add Meeting';
    addMeetingBtn.addEventListener('click', function () {
      closeDateDetail();
      openAddMeetingModalWithDate(dateStr);
    });
    actionsWrap.appendChild(addMeetingBtn);
    frag.appendChild(actionsWrap);
    bodyEl.innerHTML = '';
    bodyEl.appendChild(frag);
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }

  function closeDateDetail() {
    var modal = document.getElementById('date-detail-modal');
    if (modal) modal.hidden = true;
  }

  function openAddStayModal() {
    openAddStayModalWithStartDate(null);
  }

  function openAddStayModalWithStartDate(startDateStr) {
    var modal = document.getElementById('add-stay-modal');
    if (modal) {
      modal.hidden = false;
      modal.removeAttribute('hidden');
    }
    if (startDateStr) {
      var startInput = document.getElementById('booking-start');
      if (startInput) startInput.value = startDateStr;
    }
    if (typeof updateDateInputDisplays === 'function') updateDateInputDisplays();
  }

  function closeAddStayModal() {
    closeDatePickerPopup();
    var modal = document.getElementById('add-stay-modal');
    if (modal) modal.hidden = true;
  }

  function refreshCalendar() {
    getBookings(function (bookings) {
      getMeetings(function (meetings) {
        renderCalendar(bookings, meetings, calendarYear, calendarMonth);
      });
    });
  }

  document.getElementById('calendar-prev').addEventListener('click', function () {
    if (calendarMonth === 0) {
      calendarMonth = 11;
      calendarYear--;
    } else {
      calendarMonth--;
    }
    refreshCalendar();
  });
  document.getElementById('calendar-next').addEventListener('click', function () {
    if (calendarMonth === 11) {
      calendarMonth = 0;
      calendarYear++;
    } else {
      calendarMonth++;
    }
    refreshCalendar();
  });
  document.getElementById('open-add-stay-btn').addEventListener('click', openAddStayModal);
  document.getElementById('close-add-stay').addEventListener('click', closeAddStayModal);
  document.getElementById('add-stay-backdrop').addEventListener('click', closeAddStayModal);

  function openAddMeetingModal() {
    openAddMeetingModalWithDate(null);
  }
  function openAddMeetingModalWithDate(dateStr) {
    var modal = document.getElementById('add-meeting-modal');
    if (modal) {
      modal.hidden = false;
      modal.removeAttribute('hidden');
    }
    var dateInput = document.getElementById('meeting-date');
    if (dateInput && dateStr) dateInput.value = dateStr;
  }
  function closeAddMeetingModal() {
    var modal = document.getElementById('add-meeting-modal');
    if (modal) modal.hidden = true;
  }
  document.getElementById('open-add-meeting-btn').addEventListener('click', openAddMeetingModal);
  document.getElementById('close-add-meeting').addEventListener('click', closeAddMeetingModal);
  document.getElementById('add-meeting-backdrop').addEventListener('click', closeAddMeetingModal);

  document.getElementById('close-date-detail').addEventListener('click', closeDateDetail);
  document.getElementById('date-detail-backdrop').addEventListener('click', closeDateDetail);

  document.getElementById('meeting-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var dateVal = document.getElementById('meeting-date').value;
    var titleVal = document.getElementById('meeting-title').value.trim() || null;
    var notesVal = document.getElementById('meeting-notes').value.trim() || null;
    var fileInput = document.getElementById('meeting-files');
    var files = fileInput && fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
    if (!dateVal) {
      showMessage('bookings-messages', 'Please choose a date.', 'error');
      return;
    }
    if (!supabase) {
      showMessage('bookings-messages', 'Add your Supabase URL and key in config.js to save meetings.', 'info');
      return;
    }
    supabase.from('meetings').insert({
      meeting_date: dateVal,
      title: titleVal,
      notes: notesVal
    }).select('id').then(function (res) {
      if (res.error) {
        showMessage('bookings-messages', 'Could not save meeting: ' + res.error.message, 'error');
        return;
      }
      var raw = res.data;
      var meetingId = null;
      if (Array.isArray(raw) && raw.length > 0 && raw[0].id) meetingId = raw[0].id;
      else if (raw && raw.id) meetingId = raw.id;

      function onMeetingSaved() {
        showMessage('bookings-messages', files.length > 0 ? 'Meeting added with ' + files.length + ' file(s).' : 'Meeting added.', 'success');
        document.getElementById('meeting-form').reset();
        closeAddMeetingModal();
        refreshCalendar();
      }

      if (files.length === 0) {
        onMeetingSaved();
        return;
      }
      if (!meetingId) {
        showMessage('bookings-messages', 'Meeting saved; re-open the calendar to see it. Could not attach files.', 'info');
        refreshCalendar();
        closeAddMeetingModal();
        document.getElementById('meeting-form').reset();
        return;
      }
      var uploaded = 0;
      var total = files.length;
      function onFileDone() {
        uploaded++;
        if (uploaded >= total) {
          onMeetingSaved();
        }
      }
      files.forEach(function (file) {
        var ext = (file.name.indexOf('.') >= 0) ? file.name.slice(file.name.lastIndexOf('.')) : '';
        var path = meetingId + '/' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + ext;
        supabase.storage.from('meeting-files').upload(path, file, { upsert: false }).then(function (upRes) {
          if (upRes.error) {
            showMessage('bookings-messages', 'Meeting saved but file "' + file.name + '" failed: ' + upRes.error.message, 'error');
            onFileDone();
            return;
          }
          supabase.from('meeting_files').insert({
            meeting_id: meetingId,
            file_name: file.name,
            storage_path: path
          }).then(function (insRes) {
            if (insRes.error) showMessage('bookings-messages', 'File saved but link failed: ' + insRes.error.message, 'error');
            onFileDone();
          });
        });
      });
    });
  });

  var MEETING_FILES_BUCKET = 'meeting-files';

  function getMeetingFiles(meetingId, cb) {
    if (!supabase) { cb([]); return; }
    supabase.from('meeting_files').select('id, file_name, storage_path, created_at').eq('meeting_id', meetingId).order('created_at').then(function (res) {
      var list = res.error ? [] : (res.data || []);
      cb(list);
    });
  }

  function getFilePublicUrl(storagePath) {
    if (!supabase) return null;
    var data = supabase.storage.from(MEETING_FILES_BUCKET).getPublicUrl(storagePath);
    return data && data.data ? data.data.publicUrl : null;
  }

  function openMeetingDetail(meeting) {
    var titleEl = document.getElementById('meeting-detail-modal-title');
    var bodyEl = document.getElementById('meeting-detail-body');
    var modal = document.getElementById('meeting-detail-modal');
    if (!titleEl || !bodyEl || !modal) return;
    titleEl.textContent = meeting.title || 'Meeting';
    getMeetingFiles(meeting.id, function (files) {
      var html = '';
      html += '<div class="meeting-detail-date">' + escapeHtml(formatDateLong(meeting.meeting_date)) + '</div>';
      html += '<div class="field field-agenda">';
      html += '<label class="label">Agenda &amp; notes</label>';
      html += '<textarea class="input input-textarea-xl meeting-detail-notes-input" placeholder="Meeting notes, agenda, action items...">' + escapeHtml(meeting.notes || '') + '</textarea>';
      html += '<button type="button" class="btn btn-meeting meeting-detail-save-notes-btn">Save notes</button>';
      html += '</div>';
      html += '<div class="meeting-detail-files-section">';
      html += '<div class="meeting-detail-files-title">Attachments</div>';
      html += '<ul class="meeting-detail-files-list">';
      files.forEach(function (f) {
        var url = getFilePublicUrl(f.storage_path);
        html += '<li>';
        if (url) html += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(f.file_name) + '</a>';
        else html += '<span>' + escapeHtml(f.file_name) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
      html += '<div class="file-upload-zone file-upload-zone-inline">';
      html += '<input type="file" class="meeting-detail-file-input" multiple accept=".pdf,.doc,.docx,.txt,.md,image/*">';
      html += '<span class="file-upload-label">Drop files or click to add more</span>';
      html += '</div>';
      html += '<button type="button" class="btn btn-meeting meeting-detail-upload-btn">Upload selected</button>';
      html += '</div>';
      html += '<div class="meeting-detail-actions"><button type="button" class="btn btn-ghost meeting-detail-close-btn">Close</button></div>';
      bodyEl.innerHTML = html;
      bodyEl.querySelector('.meeting-detail-close-btn').addEventListener('click', closeMeetingDetail);
      var saveNotesBtn = bodyEl.querySelector('.meeting-detail-save-notes-btn');
      var notesInput = bodyEl.querySelector('.meeting-detail-notes-input');
      if (saveNotesBtn && notesInput) {
        saveNotesBtn.addEventListener('click', function () {
          if (!supabase) {
            showMessage('bookings-messages', 'Supabase is required to save notes.', 'info');
            return;
          }
          var notes = notesInput.value.trim() || null;
          supabase.from('meetings').update({ notes: notes }).eq('id', meeting.id).then(function (res) {
            if (res.error) showMessage('bookings-messages', 'Could not save notes: ' + res.error.message, 'error');
            else {
              showMessage('bookings-messages', 'Notes saved.', 'success');
              meeting.notes = notes;
            }
          });
        });
      }
      var uploadBtn = bodyEl.querySelector('.meeting-detail-upload-btn');
      var addFileInput = bodyEl.querySelector('.meeting-detail-file-input');
      if (uploadBtn && addFileInput) {
        uploadBtn.addEventListener('click', function () {
          var toUpload = addFileInput.files && addFileInput.files.length ? Array.prototype.slice.call(addFileInput.files) : [];
          if (toUpload.length === 0) {
            showMessage('bookings-messages', 'Choose at least one file.', 'info');
            return;
          }
          var done = 0;
          toUpload.forEach(function (file) {
            var ext = (file.name.indexOf('.') >= 0) ? file.name.slice(file.name.lastIndexOf('.')) : '';
            var path = meeting.id + '/' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + ext;
            supabase.storage.from(MEETING_FILES_BUCKET).upload(path, file, { upsert: false }).then(function (upRes) {
              if (upRes.error) {
                showMessage('bookings-messages', 'Upload failed: ' + upRes.error.message, 'error');
              } else {
                supabase.from('meeting_files').insert({ meeting_id: meeting.id, file_name: file.name, storage_path: path }).then(function () {});
              }
              done++;
              if (done >= toUpload.length) {
                openMeetingDetail(meeting);
              }
            });
          });
        });
      }
    });
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }

  function closeMeetingDetail() {
    var modal = document.getElementById('meeting-detail-modal');
    if (modal) modal.hidden = true;
  }
  document.getElementById('close-meeting-detail').addEventListener('click', closeMeetingDetail);
  document.getElementById('meeting-detail-backdrop').addEventListener('click', closeMeetingDetail);

  /* Date picker popup — range selection for start/end */
  var datePickerPopup = document.getElementById('date-picker-popup');
  var datePickerRangeStart = null;
  var datePickerRangeEnd = null;
  var datePickerYear = new Date().getFullYear();
  var datePickerMonth = new Date().getMonth();
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var startInputEl = document.getElementById('booking-start');
  var endInputEl = document.getElementById('booking-end');

  function updateDateInputDisplays() {
    var startDisplay = document.getElementById('booking-start-display');
    var endDisplay = document.getElementById('booking-end-display');
    if (startDisplay && startInputEl) {
      startDisplay.textContent = startInputEl.value ? formatMMDDYY(startInputEl.value) : 'mm/dd/yy';
    }
    if (endDisplay && endInputEl) {
      endDisplay.textContent = endInputEl.value ? formatMMDDYY(endInputEl.value) : 'mm/dd/yy';
    }
  }

  function isDateInRange(dateStr) {
    if (!datePickerRangeStart) return false;
    if (datePickerRangeEnd) {
      return dateStr >= datePickerRangeStart && dateStr <= datePickerRangeEnd;
    }
    return dateStr === datePickerRangeStart;
  }

  function formatMMDDYY(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var yy = parts[0].slice(-2);
    return parts[1] + '/' + parts[2] + '/' + yy;
  }

  function isPastDate(dateStr) {
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth() + 1).padStart(2, '0');
    var d = String(today.getDate()).padStart(2, '0');
    var todayStr = y + '-' + m + '-' + d;
    return dateStr < todayStr;
  }

  function renderDatePickerPopup() {
    if (!datePickerPopup) return;
    var first = new Date(datePickerYear, datePickerMonth, 1);
    var last = new Date(datePickerYear, datePickerMonth + 1, 0);
    var startWeekday = first.getDay();
    var daysInMonth = last.getDate();
    var todayStr = (function () {
      var t = new Date();
      return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    })();
    var html = '';
    html += '<div class="dp-header">';
    html += '<button type="button" class="btn btn-ghost btn-icon dp-prev" aria-label="Previous month">&larr;</button>';
    html += '<h4 class="dp-title">' + monthNames[datePickerMonth] + ' \'' + String(datePickerYear).slice(-2) + '</h4>';
    html += '<button type="button" class="btn btn-ghost btn-icon dp-next" aria-label="Next month">&rarr;</button>';
    html += '</div>';
    html += '<div class="dp-range-display">';
    html += '<span class="dp-range-start">Start: ' + (datePickerRangeStart ? formatMMDDYY(datePickerRangeStart) : '—') + '</span>';
    html += '<span class="dp-range-end">End: ' + (datePickerRangeEnd ? formatMMDDYY(datePickerRangeEnd) : '—') + '</span>';
    html += '</div>';
    html += '<p class="dp-hint">Click start date, then end date. Range will be highlighted.</p>';
    html += '<div class="dp-grid">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) {
      html += '<span class="dp-day-name">' + d + '</span>';
    });
    var i;
    var prevMonth = datePickerMonth === 0 ? 11 : datePickerMonth - 1;
    var prevYear = datePickerMonth === 0 ? datePickerYear - 1 : datePickerYear;
    var prevLast = new Date(prevYear, prevMonth + 1, 0).getDate();
    for (i = 0; i < startWeekday; i++) {
      var dayNum = prevLast - startWeekday + i + 1;
      var prevDateStr = prevYear + '-' + String(prevMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
      var inRange = isDateInRange(prevDateStr);
      var past = isPastDate(prevDateStr);
      html += '<button type="button" class="dp-day other-month' + (inRange ? ' in-range' : '') + (past ? ' past' : '') + '" data-date="' + prevDateStr + '"' + (past ? ' disabled' : '') + '>' + dayNum + '</button>';
    }
    for (i = 1; i <= daysInMonth; i++) {
      var dateStr = datePickerYear + '-' + String(datePickerMonth + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      var inRange = isDateInRange(dateStr);
      var past = isPastDate(dateStr);
      html += '<button type="button" class="dp-day' + (inRange ? ' in-range' : '') + (past ? ' past' : '') + '" data-date="' + dateStr + '"' + (past ? ' disabled' : '') + '>' + i + '</button>';
    }
    var nextStart = startWeekday + daysInMonth;
    var nextDay = 1;
    var nextMonth = datePickerMonth === 11 ? 0 : datePickerMonth + 1;
    var nextYear = datePickerMonth === 11 ? datePickerYear + 1 : datePickerYear;
    while (nextStart % 7 !== 0) {
      var nextDateStr = nextYear + '-' + String(nextMonth + 1).padStart(2, '0') + '-' + String(nextDay).padStart(2, '0');
      var nextInRange = isDateInRange(nextDateStr);
      var nextPast = isPastDate(nextDateStr);
      html += '<button type="button" class="dp-day other-month' + (nextInRange ? ' in-range' : '') + (nextPast ? ' past' : '') + '" data-date="' + nextDateStr + '"' + (nextPast ? ' disabled' : '') + '>' + nextDay + '</button>';
      nextStart++;
      nextDay++;
    }
    html += '</div>';
    html += '<div class="dp-actions"><button type="button" class="btn btn-ghost dp-done">Done</button></div>';
    datePickerPopup.innerHTML = html;
    datePickerPopup.querySelectorAll('.dp-day').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var dateStr = this.getAttribute('data-date');
        if (!dateStr || this.disabled) return;
        if (!datePickerRangeStart) {
          datePickerRangeStart = dateStr;
          datePickerRangeEnd = null;
          if (startInputEl) startInputEl.value = dateStr;
          updateDateInputDisplays();
          renderDatePickerPopup();
          return;
        }
        datePickerRangeEnd = dateStr;
        if (datePickerRangeEnd < datePickerRangeStart) {
          var tmp = datePickerRangeEnd;
          datePickerRangeEnd = datePickerRangeStart;
          datePickerRangeStart = tmp;
        }
        if (startInputEl) startInputEl.value = datePickerRangeStart;
        if (endInputEl) endInputEl.value = datePickerRangeEnd;
        updateDateInputDisplays();
        closeDatePickerPopup();
      });
    });
    datePickerPopup.querySelector('.dp-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      if (datePickerMonth === 0) {
        datePickerMonth = 11;
        datePickerYear--;
      } else {
        datePickerMonth--;
      }
      renderDatePickerPopup();
    });
    datePickerPopup.querySelector('.dp-next').addEventListener('click', function (e) {
      e.stopPropagation();
      if (datePickerMonth === 11) {
        datePickerMonth = 0;
        datePickerYear++;
      } else {
        datePickerMonth++;
      }
      renderDatePickerPopup();
    });
    datePickerPopup.querySelector('.dp-done').addEventListener('click', function (e) {
      e.stopPropagation();
      if (datePickerRangeStart && !datePickerRangeEnd && endInputEl) {
        endInputEl.value = datePickerRangeStart;
      }
      updateDateInputDisplays();
      closeDatePickerPopup();
    });
    var dpGrid = datePickerPopup.querySelector('.dp-grid');
    if (dpGrid) {
      dpGrid.addEventListener('mouseover', function (e) {
        if (!datePickerRangeStart || datePickerRangeEnd) return;
        var day = e.target.closest('.dp-day');
        if (!day || day.disabled) return;
        var dateStr = day.getAttribute('data-date');
        if (!dateStr) return;
        var min = datePickerRangeStart < dateStr ? datePickerRangeStart : dateStr;
        var max = datePickerRangeStart < dateStr ? dateStr : datePickerRangeStart;
        datePickerPopup.querySelectorAll('.dp-day').forEach(function (btn) {
          var d = btn.getAttribute('data-date');
          if (d >= min && d <= max) btn.classList.add('in-range-preview');
          else btn.classList.remove('in-range-preview');
        });
      });
      dpGrid.addEventListener('mouseleave', function () {
        datePickerPopup.querySelectorAll('.dp-day').forEach(function (btn) {
          btn.classList.remove('in-range-preview');
        });
      });
    }
  }

  function openDatePickerPopup(fromInputEl) {
    var startVal = startInputEl ? startInputEl.value : '';
    var endVal = endInputEl ? endInputEl.value : '';
    datePickerRangeStart = startVal || null;
    datePickerRangeEnd = endVal || null;
    if (datePickerRangeStart && datePickerRangeEnd && datePickerRangeEnd < datePickerRangeStart) {
      datePickerRangeEnd = datePickerRangeStart;
    }
    var val = fromInputEl && fromInputEl.value ? fromInputEl.value : (datePickerRangeStart || '');
    if (val) {
      var d = new Date(val);
      if (!isNaN(d.getTime())) {
        datePickerYear = d.getFullYear();
        datePickerMonth = d.getMonth();
      }
    } else {
      datePickerYear = new Date().getFullYear();
      datePickerMonth = new Date().getMonth();
    }
    renderDatePickerPopup();
    datePickerPopup.classList.add('is-open');
    datePickerPopup.setAttribute('aria-hidden', 'false');
    var rect = fromInputEl ? fromInputEl.getBoundingClientRect() : (datePickerPopup.getBoundingClientRect());
    var formEl = datePickerPopup.closest('form');
    var formRect = formEl ? formEl.getBoundingClientRect() : rect;
    datePickerPopup.style.position = 'absolute';
    datePickerPopup.style.top = (rect.bottom - formRect.top + 8) + 'px';
    datePickerPopup.style.left = '0';
    datePickerPopup.style.right = '0';
    datePickerPopup.style.width = '100%';
  }

  function closeDatePickerPopup() {
    if (datePickerPopup) {
      datePickerPopup.classList.remove('is-open');
      datePickerPopup.setAttribute('aria-hidden', 'true');
    }
    datePickerRangeStart = null;
    datePickerRangeEnd = null;
  }

  function setupDateInputPicker(inputId, triggerId) {
    var input = document.getElementById(inputId);
    var trigger = document.getElementById(triggerId);
    if (!input || !datePickerPopup) return;
    function open() {
      openDatePickerPopup(input);
    }
    if (trigger) trigger.addEventListener('click', function (e) { e.preventDefault(); open(); });
    input.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
  }
  setupDateInputPicker('booking-start', 'date-picker-trigger-start');
  setupDateInputPicker('booking-end', 'date-picker-trigger-end');
  if (startInputEl) {
    startInputEl.addEventListener('input', updateDateInputDisplays);
    startInputEl.addEventListener('change', updateDateInputDisplays);
  }
  if (endInputEl) {
    endInputEl.addEventListener('input', updateDateInputDisplays);
    endInputEl.addEventListener('change', updateDateInputDisplays);
  }
  document.addEventListener('click', function (e) {
    if (datePickerPopup && datePickerPopup.classList.contains('is-open')) {
      if (!datePickerPopup.contains(e.target) && !e.target.closest('.input-wrap-date')) {
        closeDatePickerPopup();
      }
    }
  });
  document.getElementById('booking-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var start = document.getElementById('booking-start').value;
    var end = document.getElementById('booking-end').value;
    var who = document.getElementById('booking-who').value.trim() || null;
    var yearly = document.getElementById('booking-yearly').checked;

    if (!start || !end) {
      showMessage('bookings-messages', 'Please choose start and end dates.', 'error');
      return;
    }
    if (end < start) {
      showMessage('bookings-messages', 'End date must be on or after start date.', 'error');
      return;
    }

    function onSuccess() {
      showMessage('bookings-messages', 'Your stay has been confirmed.', 'success');
      document.getElementById('booking-form').reset();
      document.getElementById('booking-yearly').checked = false;
      closeAddStayModal();
      refreshCalendar();
    }

    if (supabase) {
      supabase.from('bookings').insert({ start_date: start, end_date: end, who: who, is_yearly: yearly }).then(function (res) {
        if (res.error) {
          showMessage('bookings-messages', 'Could not save: ' + res.error.message, 'error');
          return;
        }
        onSuccess();
      });
    } else {
      saveBookingToLocal(start, end, who, yearly);
      onSuccess();
    }
  });

  function loadVendors(cb) {
    if (!supabase) {
      cb(PLACEHOLDER_VENDORS);
      return;
    }
    supabase.from('vendors').select('*').order('category').order('name').then(function (res) {
      var list = res.error ? [] : (res.data || []);
      if (list.length === 0) list = PLACEHOLDER_VENDORS;
      cb(list);
    });
  }

  var currentVendorInModal = null;

  function openVendorDetail(vendor) {
    currentVendorInModal = vendor;
    var titleEl = document.getElementById('vendor-detail-modal-title');
    var bodyEl = document.getElementById('vendor-detail-body');
    var modal = document.getElementById('vendor-detail-modal');
    if (!titleEl || !bodyEl || !modal) return;
    titleEl.textContent = vendor.name || 'Vendor';
    var html = '';
    html += '<div class="vendor-detail-name">' + escapeHtml(vendor.name || '') + '</div>';
    if (vendor.contact_name) {
      html += '<div class="vendor-detail-contact-name">' + escapeHtml(vendor.contact_name) + '</div>';
    }
    html += '<div class="vendor-detail-contact">';
    if (vendor.phone) {
      html += '<a href="tel:' + (vendor.phone || '').replace(/\D/g, '') + '">' + escapeHtml(vendor.phone) + '</a>';
    }
    if (vendor.email) {
      html += '<a href="mailto:' + escapeHtml(vendor.email) + '">' + escapeHtml(vendor.email) + '</a>';
    }
    html += '</div>';
    if (vendor.notes) {
      html += '<div class="vendor-detail-notes">' + escapeHtml(vendor.notes) + '</div>';
    } else {
      html += '<div class="vendor-detail-notes empty">No notes yet.</div>';
    }
    html += '<div class="vendor-detail-actions">';
    html += '<button type="button" class="btn btn-primary vendor-detail-edit-btn">Edit</button>';
    if (vendor.id) {
      html += ' <button type="button" class="btn btn-ghost vendor-detail-remove-btn">Remove</button>';
    }
    html += '</div>';
    bodyEl.innerHTML = html;
    bodyEl.querySelector('.vendor-detail-edit-btn').addEventListener('click', function () {
      showVendorEditForm(vendor, bodyEl, modal, titleEl);
    });
    var removeBtn = bodyEl.querySelector('.vendor-detail-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (!confirm('Remove this vendor?')) return;
        if (!supabase) {
          showMessage('vendors-messages', 'Supabase is required to remove vendors.', 'info');
          return;
        }
        supabase.from('vendors').delete().eq('id', vendor.id).then(function (res) {
          if (res.error) {
            showMessage('vendors-messages', 'Could not remove: ' + res.error.message, 'error');
            return;
          }
          showMessage('vendors-messages', 'Vendor removed.', 'success');
          closeVendorDetail();
          loadVendors(renderVendors);
        });
      });
    }
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }

  function showVendorEditForm(vendor, bodyEl, modal, titleEl) {
    titleEl.textContent = vendor.id ? 'Edit vendor' : 'Save as real vendor';
    var currentCat = (vendor.category && String(vendor.category).trim()) || 'other';
    var isCustomCat = currentCat && VENDOR_CATEGORIES.indexOf(currentCat) < 0;
    var html = '<form class="vendor-edit-form">';
    html += '<div class="field"><label class="label">Category</label><select class="input vendor-edit-category">';
    VENDOR_CATEGORIES.forEach(function (c) {
      var sel = (!isCustomCat && vendor.category === c) ? ' selected' : '';
      html += '<option value="' + c + '"' + sel + '>' + (c.charAt(0).toUpperCase() + c.slice(1)) + '</option>';
    });
    html += '<option value="other"' + (isCustomCat ? ' selected' : '') + '>Other (specify below)</option>';
    html += '</select></div>';
    html += '<div class="field vendor-edit-category-other-wrap" style="' + (isCustomCat ? '' : 'display:none;') + '"><label class="label">Category name</label><input type="text" class="input vendor-edit-category-other" value="' + (isCustomCat ? escapeHtml(currentCat) : '') + '" placeholder="e.g. HVAC, Landscaping"></div>';
    html += '<div class="field"><label class="label">Company name</label><input type="text" class="input vendor-edit-name" value="' + escapeHtml(vendor.name || '') + '" placeholder="Business name"></div>';
    html += '<div class="field"><label class="label">Contact name</label><input type="text" class="input vendor-edit-contact-name" value="' + escapeHtml(vendor.contact_name || '') + '" placeholder="Person to ask for"></div>';
    html += '<div class="field"><label class="label">Phone</label><input type="tel" class="input vendor-edit-phone" value="' + escapeHtml(vendor.phone || '') + '" placeholder="(555) 123-4567"></div>';
    html += '<div class="field"><label class="label">Email</label><input type="email" class="input vendor-edit-email" value="' + escapeHtml(vendor.email || '') + '" placeholder="email@example.com"></div>';
    html += '<div class="field"><label class="label">Notes</label><textarea class="input vendor-edit-notes" rows="3" placeholder="Optional notes">' + escapeHtml(vendor.notes || '') + '</textarea></div>';
    html += '<div class="vendor-edit-actions"><button type="button" class="btn btn-ghost vendor-edit-cancel">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form>';
    bodyEl.innerHTML = html;
    bodyEl.querySelector('.vendor-edit-cancel').addEventListener('click', function () {
      openVendorDetail(vendor);
    });
    bodyEl.querySelector('.vendor-edit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var category = bodyEl.querySelector('.vendor-edit-category').value;
      var name = bodyEl.querySelector('.vendor-edit-name').value.trim();
      var contactName = bodyEl.querySelector('.vendor-edit-contact-name').value.trim() || null;
      var phone = bodyEl.querySelector('.vendor-edit-phone').value.trim() || null;
      var email = bodyEl.querySelector('.vendor-edit-email').value.trim() || null;
      var notes = bodyEl.querySelector('.vendor-edit-notes').value.trim() || null;
      if (!name) {
        showMessage('vendors-messages', 'Company name is required.', 'error');
        return;
      }
      if (editCatSel.value === 'other' && !(editCatOtherInput && editCatOtherInput.value.trim())) {
        showMessage('vendors-messages', 'Please enter a category name (e.g. HVAC, Landscaping).', 'error');
        return;
      }
      if (!supabase) {
        showMessage('vendors-messages', 'Add your Supabase URL and key in config.js to save changes.', 'info');
        return;
      }
      if (vendor.id) {
        supabase.from('vendors').update({ category: category, name: name, contact_name: contactName, phone: phone, email: email, notes: notes }).eq('id', vendor.id).then(function (res) {
          if (res.error) {
            showMessage('vendors-messages', 'Could not update: ' + res.error.message, 'error');
            return;
          }
          showMessage('vendors-messages', 'Vendor updated.', 'success');
          closeVendorDetail();
          loadVendors(renderVendors);
        });
      } else {
        supabase.from('vendors').insert({ category: category, name: name, contact_name: contactName, phone: phone, email: email, notes: notes }).then(function (res) {
          if (res.error) {
            showMessage('vendors-messages', 'Could not save: ' + res.error.message, 'error');
            return;
          }
          showMessage('vendors-messages', 'Vendor saved.', 'success');
          closeVendorDetail();
          loadVendors(renderVendors);
        });
      }
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function closeVendorDetail() {
    var modal = document.getElementById('vendor-detail-modal');
    if (modal) modal.hidden = true;
  }

  document.getElementById('close-vendor-detail').addEventListener('click', closeVendorDetail);
  document.getElementById('vendor-detail-backdrop').addEventListener('click', closeVendorDetail);

  function getDisplayCategories(vendors) {
    var seen = {};
    vendors.forEach(function (v) {
      var c = (v.category && String(v.category).trim()) || 'other';
      seen[c] = true;
    });
    var predefined = VENDOR_CATEGORIES.filter(function (c) { return seen[c]; });
    var custom = Object.keys(seen).filter(function (c) { return VENDOR_CATEGORIES.indexOf(c) < 0; }).sort();
    return predefined.concat(custom);
  }

  function renderVendors(vendors) {
    var list = document.getElementById('vendors-list');
    if (!list) return;

    var byCategory = {};
    vendors.forEach(function (v) {
      var cat = (v.category && String(v.category).trim()) || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(v);
    });

    var categories = getDisplayCategories(vendors);
    list.innerHTML = '';
    categories.forEach(function (cat) {
      var items = byCategory[cat] || [];
      if (items.length === 0) return;
      var section = document.createElement('div');
      section.className = 'vendor-category';
      var title = document.createElement('h3');
      title.className = 'vendor-category-title';
      title.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      section.appendChild(title);
      var cards = document.createElement('div');
      cards.className = 'vendor-cards';
      items.forEach(function (v) {
        var card = document.createElement('div');
        card.className = 'vendor-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        var name = document.createElement('div');
        name.className = 'vendor-card-name';
        name.textContent = v.name || 'Unnamed';
        card.appendChild(name);
        if (v.contact_name) {
          var contactName = document.createElement('div');
          contactName.className = 'vendor-card-contact-name';
          contactName.textContent = v.contact_name;
          card.appendChild(contactName);
        }
        var phone = document.createElement('div');
        phone.className = 'vendor-card-phone';
        phone.textContent = v.phone || 'No phone';
        card.appendChild(phone);
        cards.appendChild(card);
        card.addEventListener('click', function () {
          openVendorDetail(v);
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openVendorDetail(v);
          }
        });
      });
      section.appendChild(cards);
      list.appendChild(section);
    });

    if (vendors.length === 0) {
      list.innerHTML = '<p class="message info">No vendors yet. Add one below.</p>';
    }
  }

  (function setupVendorCategoryOther() {
    var sel = document.getElementById('vendor-category');
    var wrap = document.getElementById('vendor-category-other-wrap');
    var otherInput = document.getElementById('vendor-category-other');
    if (!sel || !wrap || !otherInput) return;
    function toggle() {
      wrap.style.display = sel.value === 'other' ? 'block' : 'none';
      if (sel.value !== 'other') otherInput.value = '';
    }
    sel.addEventListener('change', toggle);
    document.getElementById('vendor-form').addEventListener('reset', function () {
      setTimeout(toggle, 0);
    });
  })();

  document.getElementById('vendor-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var categorySel = document.getElementById('vendor-category');
    var category = categorySel.value === 'other'
      ? (document.getElementById('vendor-category-other').value.trim() || '')
      : categorySel.value;
    var name = document.getElementById('vendor-name').value.trim();
    var contactName = document.getElementById('vendor-contact-name').value.trim() || null;
    var phone = document.getElementById('vendor-phone').value.trim() || null;
    var email = document.getElementById('vendor-email').value.trim() || null;

    if (categorySel.value === 'other' && !category) {
      showMessage('vendors-messages', 'Please enter a category name (e.g. HVAC, Landscaping).', 'error');
      return;
    }
    if (!name) {
      showMessage('vendors-messages', 'Company name is required.', 'error');
      return;
    }
    if (!supabase) {
      showMessage('vendors-messages', 'Add your Supabase URL and key in config.js to save vendors.', 'info');
      return;
    }
    supabase.from('vendors').insert({
      category: category || 'other',
      name: name,
      contact_name: contactName,
      phone: phone,
      email: email,
      notes: null
    }).then(function (res) {
      if (res.error) {
        showMessage('vendors-messages', 'Could not save: ' + res.error.message, 'error');
        return;
      }
      showMessage('vendors-messages', 'Vendor added.', 'success');
      document.getElementById('vendor-form').reset();
      document.getElementById('vendor-category-other-wrap').style.display = 'none';
      loadVendors(renderVendors);
    });
  });

  function init() {
    refreshCalendar();
    loadVendors(renderVendors);
    if (typeof updateDateInputDisplays === 'function') updateDateInputDisplays();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
