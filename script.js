(function () {
  "use strict";

  var budgetForm = document.getElementById("budget-form");
  var budgetInput = document.getElementById("budget-input");
  var budgetError = document.getElementById("budget-error");
  var budgetSuccess = document.getElementById("budget-success");

  var expenseForm = document.getElementById("expense-form");
  var expenseNameInput = document.getElementById("expense-name");
  var expenseCategoryInput = document.getElementById("expense-category");
  var expenseDateInput = document.getElementById("expense-date");
  var expenseAmountInput = document.getElementById("expense-amount");
  var expenseError = document.getElementById("expense-error");
  var quickExpenseBox = document.getElementById("quick-expenses");
  var quickButtons = quickExpenseBox.querySelectorAll("[data-quick-name]");
  var selectedQuickName = "";
  var QUICK_CATEGORIES = {
    "아침": "식비",
    "점심": "식비",
    "저녁": "식비",
    "커피": "식비",
    "교통": "교통비",
    "숙박": "숙박비",
    "쇼핑": "기타"
  };

  var summary = document.getElementById("summary");
  var budgetValue = document.getElementById("budget-value");
  var spentValue = document.getElementById("spent-value");
  var remainLabel = document.getElementById("remain-label");
  var remainValue = document.getElementById("remain-value");
  var guide = document.getElementById("guide");

  var listCount = document.getElementById("list-count");
  var emptyList = document.getElementById("empty-list");
  var dayEmpty = document.getElementById("day-empty");
  var dayTotal = document.getElementById("day-total");
  var expenseGroups = document.getElementById("expense-groups");
  var moveNoticeEl = document.getElementById("move-notice");
  var viewAllButton = document.getElementById("view-all");
  var filterDateInput = document.getElementById("filter-date");
  var storageNotice = document.getElementById("storage-notice");
  var footnote = document.getElementById("footnote");

  var currentTripName = document.getElementById("current-trip-name");
  var noTrip = document.getElementById("no-trip");
  var tripCard = document.getElementById("trip-card");
  var calculator = document.getElementById("calculator");
  var tripSelect = document.getElementById("trip-select");
  var tripRenameInput = document.getElementById("trip-rename-input");
  var tripRenameError = document.getElementById("trip-rename-error");
  var tripStatus = document.getElementById("trip-status");
  var tripRenameButton = document.getElementById("trip-rename-button");
  var tripDeleteOpen = document.getElementById("trip-delete-open");
  var tripManage = document.getElementById("trip-manage");
  var tripManageToggle = document.getElementById("trip-manage-toggle");
  var tripManageLabel = document.getElementById("trip-manage-label");
  var tripManageOpen = false;
  var newTripOpenButton = document.getElementById("new-trip-open");
  var newTripDialog = document.getElementById("new-trip-dialog");
  var newTripForm = document.getElementById("new-trip-form");
  var newTripNameInput = document.getElementById("new-trip-name");
  var newTripError = document.getElementById("new-trip-error");
  var newTripCancel = document.getElementById("new-trip-cancel");
  var deleteTripDialog = document.getElementById("delete-trip-dialog");
  var deleteTripForm = document.getElementById("delete-trip-form");
  var deleteTripName = document.getElementById("delete-trip-name");
  var deleteTripCancel = document.getElementById("delete-trip-cancel");
  var deleteTripConfirm = document.getElementById("delete-trip-confirm");
  var backupButton = document.getElementById("backup-records");
  var backupStatus = document.getElementById("backup-status");
  var backupError = document.getElementById("backup-error");
  var restoreOpenButton = document.getElementById("restore-open");
  var restoreFileInput = document.getElementById("restore-file");
  var restoreDialog = document.getElementById("restore-dialog");
  var restoreSummary = document.getElementById("restore-summary");
  var restoreError = document.getElementById("restore-error");
  var restoreCancel = document.getElementById("restore-cancel");
  var restoreConfirm = document.getElementById("restore-confirm");
  var restorePlan = null;
  var restoreBusy = false;
  var RESTORE_SUFFIX = " (복원)";

  var state = {
    trips: [],
    activeTripId: null,
    nextExpenseId: 1
  };

  var pendingDeleteId = null;
  var editingId = null;
  var dayEditMode = false;
  var moveNotice = "";
  var lastAddedId = null;
  var view = {
    mode: "all",
    date: null
  };
  var storageBlocked = false;
  var MAX_MONEY = 1000000000000;
  var MAX_NAME = 30;
  var STORAGE_KEY = "travel-budget-trips";
  var LEGACY_KEY = "travel-budget-records";
  var BACKUP_KEY = "travel-budget-records-backup";
  var LEGACY_TRIP_NAME = "기존 여행";
  var CATEGORIES = {
    "식비": true,
    "교통비": true,
    "숙박비": true,
    "기타": true
  };

  function formatNumber(amount) {
    return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatWon(amount) {
    return formatNumber(amount) + "원";
  }

  function todayLocalDate() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
  }

  function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function formatKoreanDate(isoDate) {
    var parts = isoDate.split("-");
    return Number(parts[0]) + "년 " + Number(parts[1]) + "월 " + Number(parts[2]) + "일";
  }

  function sumExpenses(list) {
    return list.reduce(function (sum, expense) {
      return sum + expense.amount;
    }, 0);
  }

  function normalizeMoneyText(raw) {
    return String(raw)
      .trim()
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
      })
      .replace(/，/g, ",")
      .replace(/원/g, "")
      .replace(/\s/g, "");
  }

  function parseMoney(raw) {
    var text = normalizeMoneyText(raw);

    if (text === "") {
      return { ok: false, empty: true };
    }

    if (!/^[\d,]+$/.test(text)) {
      return { ok: false, empty: false };
    }

    var digits = text.replace(/,/g, "");

    if (digits === "" || !/^\d+$/.test(digits)) {
      return { ok: false, empty: false };
    }

    if (digits.length > 16) {
      return { ok: false, empty: false, tooBig: true };
    }

    var value = Number(digits);

    if (!Number.isSafeInteger(value) || value > MAX_MONEY) {
      return { ok: false, empty: false, tooBig: true };
    }

    if (value < 1) {
      return { ok: false, empty: false };
    }

    return { ok: true, value: value };
  }

  function moneyErrorMessage(result, emptyText, example) {
    if (result.empty) {
      return emptyText;
    }
    if (result.tooBig) {
      return "금액이 너무 큽니다. 1조 원 이하로 입력해 주세요.";
    }
    return "1원 이상의 숫자로 입력해 주세요. 예: " + example;
  }

  function showMessage(element, text) {
    element.hidden = false;
    element.textContent = text;
  }

  function clearMessage(element) {
    element.hidden = true;
    element.textContent = "";
  }

  function markInvalid(input, errorId) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", errorId);
  }

  function markValid(input) {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }

  function setGuide(type, lines) {
    guide.className = "guide guide-" + type;
    guide.replaceChildren();

    lines.forEach(function (line, index) {
      var paragraph = document.createElement("p");
      paragraph.className = index === 0 ? "guide-strong" : "guide-text";
      paragraph.textContent = line;
      guide.appendChild(paragraph);
    });
  }

  function getActiveTrip() {
    var found = null;
    state.trips.forEach(function (trip) {
      if (trip.id === state.activeTripId) {
        found = trip;
      }
    });
    return found;
  }

  function getExpenses() {
    var trip = getActiveTrip();
    if (!trip) {
      return [];
    }
    return trip.expenses;
  }

  function getSpent() {
    return sumExpenses(getExpenses());
  }

  function renderSummary() {
    var trip = getActiveTrip();
    var spent = getSpent();
    spentValue.textContent = formatWon(spent);

    if (!trip || trip.budget === null || trip.budget === undefined) {
      budgetValue.textContent = "아직 없습니다";
      remainLabel.textContent = "남은 예산";
      remainValue.textContent = "없음";
      remainValue.classList.remove("is-over");
      setGuide("wait", ["여행 전체 예산을 설정하면 남은 돈이 여기에 계산됩니다."]);
      return;
    }

    budgetValue.textContent = formatWon(trip.budget);

    if (trip.budget === 0 && spent === 0) {
      remainLabel.textContent = "남은 예산";
      remainValue.textContent = formatWon(0);
      remainValue.classList.remove("is-over");
      setGuide("wait", ["여행 전체 예산을 설정하면 남은 돈이 여기에 계산됩니다."]);
      return;
    }

    if (spent > trip.budget) {
      var over = spent - trip.budget;
      remainLabel.textContent = "초과 금액";
      remainValue.textContent = formatWon(over);
      remainValue.classList.add("is-over");
      setGuide("over", [
        "초과 금액: " + formatWon(over),
        "여행 전체 예산보다 " + formatWon(over) + "을 더 사용했습니다. 지출 내역을 다시 확인해 주세요."
      ]);
      return;
    }

    var remain = trip.budget - spent;
    remainLabel.textContent = "남은 예산";
    remainValue.textContent = formatWon(remain);
    remainValue.classList.remove("is-over");

    if (remain === 0) {
      setGuide("ok", ["예산을 모두 사용했습니다."]);
    } else {
      setGuide("ok", ["아직 " + formatWon(remain) + "을 사용할 수 있습니다."]);
    }
  }

  function createExpenseItem(expense) {
    var item = document.createElement("li");
    item.className = "expense-item";
    item.dataset.id = String(expense.id);

    if (expense.id === lastAddedId) {
      item.classList.add("is-new");
    }

    var top = document.createElement("div");
    top.className = "expense-top";

    var name = document.createElement("p");
    name.className = "expense-name";
    name.textContent = expense.name;

    var amount = document.createElement("p");
    amount.className = "expense-amount";
    amount.textContent = formatWon(expense.amount);

    top.appendChild(name);
    top.appendChild(amount);

    var meta = document.createElement("div");
    meta.className = "expense-meta";

    var category = document.createElement("p");
    category.className = "expense-category";
    category.textContent = expense.category;
    meta.appendChild(category);

    if (expense.id === lastAddedId) {
      var badge = document.createElement("p");
      badge.className = "new-badge";
      badge.textContent = "방금 추가";
      meta.appendChild(badge);
    }

    var dateLine = document.createElement("p");
    dateLine.className = "expense-date";
    if (expense.date) {
      dateLine.textContent = formatKoreanDate(expense.date);
    } else {
      dateLine.classList.add("is-undated");
      dateLine.textContent = "날짜 미지정";
    }

    item.appendChild(top);
    item.appendChild(dateLine);
    item.appendChild(meta);

    if (editingId === expense.id) {
      item.appendChild(createEditBox(expense));
      return item;
    }

    if (!expense.date && pendingDeleteId !== expense.id) {
      var assignBox = document.createElement("div");
      assignBox.className = "assign-date";

      var assignLabel = document.createElement("label");
      var assignInputId = "assign-date-" + expense.id;
      assignLabel.setAttribute("for", assignInputId);
      assignLabel.textContent = "이 지출의 날짜";

      var assignInput = document.createElement("input");
      assignInput.type = "date";
      assignInput.id = assignInputId;
      assignInput.value = todayLocalDate();
      assignInput.setAttribute("data-assign-input", "true");

      var assignError = document.createElement("p");
      assignError.className = "message message-error";
      assignError.hidden = true;
      assignError.setAttribute("data-assign-error", "true");

      var assignButton = document.createElement("button");
      assignButton.type = "button";
      assignButton.className = "btn btn-secondary";
      assignButton.dataset.action = "assign-date";
      assignButton.textContent = "날짜 지정";

      assignBox.appendChild(assignLabel);
      assignBox.appendChild(assignInput);
      assignBox.appendChild(assignError);
      assignBox.appendChild(assignButton);
      item.appendChild(assignBox);
    }

    if (pendingDeleteId === expense.id) {
      var question = document.createElement("p");
      question.className = "confirm-copy";
      question.textContent = "이 지출을 삭제할까요?";

      var actions = document.createElement("div");
      actions.className = "button-stack";

      var yesButton = document.createElement("button");
      yesButton.type = "button";
      yesButton.className = "btn btn-delete";
      yesButton.dataset.action = "confirm-delete";
      yesButton.textContent = "네, 삭제";

      var noButton = document.createElement("button");
      noButton.type = "button";
      noButton.className = "btn btn-secondary";
      noButton.dataset.action = "cancel-delete";
      noButton.textContent = "아니요";

      actions.appendChild(yesButton);
      actions.appendChild(noButton);
      item.appendChild(question);
      item.appendChild(actions);
    } else {
      var editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn btn-secondary";
      editButton.dataset.action = "start-edit";
      editButton.textContent = "수정";
      editButton.setAttribute("aria-label", expense.name + " 수정");

      var deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-delete";
      deleteButton.dataset.action = "ask-delete";
      deleteButton.textContent = "삭제";
      deleteButton.setAttribute("aria-label", expense.name + " 삭제");

      item.appendChild(editButton);
      item.appendChild(deleteButton);
    }

    return item;
  }

  function createEditBox(expense) {
    var box = document.createElement("div");
    box.className = "edit-box";

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 30;
    nameInput.value = expense.name;
    nameInput.setAttribute("data-edit-name", "true");
    nameInput.autocomplete = "off";
    appendEditField(box, "항목 이름", "edit-name-" + expense.id, nameInput);

    var categorySelect = createCategorySelect("edit-category-" + expense.id, expense.category);
    var categoryLabel = document.createElement("label");
    categoryLabel.setAttribute("for", categorySelect.id);
    categoryLabel.textContent = "분류";
    box.appendChild(categoryLabel);
    box.appendChild(categorySelect);

    var dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = expense.date || "";
    dateInput.setAttribute("data-edit-date", "true");
    appendEditField(box, "지출 날짜", "edit-date-" + expense.id, dateInput);

    if (!expense.date) {
      var dateHint = document.createElement("p");
      dateHint.className = "hint";
      dateHint.textContent = "날짜가 없습니다. 달력에서 날짜를 선택해 주세요.";
      box.appendChild(dateHint);
    }

    var amountInput = document.createElement("input");
    amountInput.type = "text";
    amountInput.inputMode = "numeric";
    amountInput.maxLength = 20;
    amountInput.value = formatNumber(expense.amount);
    amountInput.setAttribute("data-edit-amount", "true");
    amountInput.autocomplete = "off";
    amountInput.spellcheck = false;
    appendEditField(box, "금액 (원)", "edit-amount-" + expense.id, amountInput);

    var errorBox = document.createElement("p");
    errorBox.className = "message message-error";
    errorBox.hidden = true;
    errorBox.setAttribute("data-edit-error", "true");
    box.appendChild(errorBox);

    var actions = document.createElement("div");
    actions.className = "button-stack";

    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn btn-primary";
    saveButton.dataset.action = "save-edit";
    saveButton.textContent = "수정 저장";

    var cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-secondary";
    cancelButton.dataset.action = "cancel-edit";
    cancelButton.textContent = "취소";

    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    box.appendChild(actions);

    box.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        saveButton.click();
      }
    });

    return box;
  }

  function syncViewControls() {
    var showingAll = view.mode !== "day";
    viewAllButton.setAttribute("aria-pressed", showingAll ? "true" : "false");
    viewAllButton.className = showingAll ? "btn btn-primary" : "btn btn-secondary";
    filterDateInput.value = view.mode === "day" ? view.date : "";
  }

  function appendExpenseGroup(title, subtotalText, expenses) {
    var section = document.createElement("section");
    section.className = "date-group";

    var heading = document.createElement("div");
    heading.className = "date-heading";

    var headingText = document.createElement("h3");
    headingText.textContent = title;

    var subtotal = document.createElement("p");
    subtotal.className = "date-subtotal";
    subtotal.textContent = subtotalText;

    var list = document.createElement("ul");
    list.className = "expense-list";
    expenses.forEach(function (expense) {
      list.appendChild(createExpenseItem(expense));
    });

    heading.appendChild(headingText);
    heading.appendChild(subtotal);
    section.appendChild(heading);
    section.appendChild(list);
    expenseGroups.appendChild(section);
  }

  function groupExpenses() {
    var undated = [];
    var byDate = {};
    var dates = [];

    getExpenses().forEach(function (expense) {
      if (!expense.date) {
        undated.push(expense);
        return;
      }
      if (!byDate[expense.date]) {
        byDate[expense.date] = [];
        dates.push(expense.date);
      }
      byDate[expense.date].push(expense);
    });

    dates.sort(function (left, right) {
      if (left === right) {
        return 0;
      }
      return left < right ? 1 : -1;
    });

    return {
      undated: undated,
      dates: dates,
      byDate: byDate
    };
  }

  function createDayLine(expense) {
    var item = document.createElement("li");
    item.className = "day-line";
    item.dataset.id = String(expense.id);

    if (!(dayEditMode && editingId === expense.id)) {
      var main = document.createElement("div");
      main.className = "day-line-main";

      var name = document.createElement("p");
      name.className = "day-line-name";
      name.textContent = expense.name;

      var amount = document.createElement("p");
      amount.className = "day-line-amount";
      amount.textContent = formatWon(expense.amount);

      main.appendChild(name);
      main.appendChild(amount);
      item.appendChild(main);
    }

    if (!dayEditMode) {
      return item;
    }

    if (editingId === expense.id) {
      item.appendChild(createEditBox(expense));
      return item;
    }

    if (pendingDeleteId === expense.id) {
      var question = document.createElement("p");
      question.className = "confirm-copy";
      question.textContent = "이 지출을 삭제할까요?";

      var confirmActions = document.createElement("div");
      confirmActions.className = "button-stack";

      var yesButton = document.createElement("button");
      yesButton.type = "button";
      yesButton.className = "btn btn-delete";
      yesButton.dataset.action = "confirm-delete";
      yesButton.textContent = "네, 삭제";

      var noButton = document.createElement("button");
      noButton.type = "button";
      noButton.className = "btn btn-secondary";
      noButton.dataset.action = "cancel-delete";
      noButton.textContent = "아니요";

      confirmActions.appendChild(yesButton);
      confirmActions.appendChild(noButton);
      item.appendChild(question);
      item.appendChild(confirmActions);
      return item;
    }

    var actions = document.createElement("div");
    actions.className = "day-line-actions";

    var editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-secondary";
    editButton.dataset.action = "start-edit";
    editButton.textContent = "수정";
    editButton.setAttribute("aria-label", expense.name + " 수정");

    var deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-delete";
    deleteButton.dataset.action = "ask-delete";
    deleteButton.textContent = "삭제";
    deleteButton.setAttribute("aria-label", expense.name + " 삭제");

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    item.appendChild(actions);
    return item;
  }

  function renderAllView() {
    var expenses = getExpenses();
    var count = expenses.length;
    listCount.hidden = false;
    dayTotal.hidden = true;
    dayEmpty.hidden = true;

    if (count === 0) {
      listCount.textContent = "아직 적은 지출이 없습니다.";
      emptyList.hidden = false;
      return;
    }

    emptyList.hidden = true;
    var groups = groupExpenses();

    if (groups.undated.length > 0) {
      listCount.textContent = "총 " + count + "건입니다. 날짜가 없는 지출은 맨 위에 있고, 그 아래는 최근 날짜부터입니다.";
    } else {
      listCount.textContent = "총 " + count + "건입니다. 최근 날짜가 위에 표시됩니다.";
    }

    if (groups.undated.length > 0) {
      appendExpenseGroup(
        "날짜 미지정",
        "합계 " + formatWon(sumExpenses(groups.undated)),
        groups.undated
      );
    }

    groups.dates.forEach(function (date) {
      var items = groups.byDate[date];
      appendExpenseGroup(
        formatKoreanDate(date),
        "이 날짜 합계 " + formatWon(sumExpenses(items)),
        items
      );
    });
  }

  function renderDayView() {
    var items = getExpenses().filter(function (expense) {
      return expense.date === view.date;
    });
    var dateLabel = formatKoreanDate(view.date);

    emptyList.hidden = true;
    listCount.hidden = true;
    dayTotal.hidden = true;
    dayEmpty.hidden = true;

    if (items.length === 0) {
      dayEditMode = false;
    }

    var sheet = document.createElement("div");
    sheet.className = "day-sheet";

    var title = document.createElement("h3");
    title.className = "day-sheet-title";
    title.textContent = dateLabel + " · 총 " + items.length + "건";
    sheet.appendChild(title);

    if (items.length > 0) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = dayEditMode ? "btn btn-primary day-edit-toggle" : "btn btn-secondary day-edit-toggle";
      toggle.dataset.action = "toggle-day-edit";
      toggle.setAttribute("aria-pressed", dayEditMode ? "true" : "false");
      toggle.textContent = dayEditMode ? "편집 완료" : "내역 편집";
      sheet.appendChild(toggle);
    }

    if (items.length === 0) {
      var empty = document.createElement("p");
      empty.className = "day-sheet-empty";
      empty.textContent = "이 날짜에는 지출이 없습니다.";
      sheet.appendChild(empty);
      expenseGroups.appendChild(sheet);
      return;
    }

    var list = document.createElement("ul");
    list.className = "day-lines";
    items.forEach(function (expense) {
      list.appendChild(createDayLine(expense));
    });

    var sum = document.createElement("div");
    sum.className = "day-sum";

    var sumLabel = document.createElement("p");
    sumLabel.className = "day-sum-label";
    sumLabel.textContent = "합계";

    var sumAmount = document.createElement("p");
    sumAmount.className = "day-sum-amount";
    sumAmount.textContent = formatWon(sumExpenses(items));

    sum.appendChild(sumLabel);
    sum.appendChild(sumAmount);
    sheet.appendChild(list);
    sheet.appendChild(sum);
    expenseGroups.appendChild(sheet);
  }

  function renderList() {
    syncViewControls();
    expenseGroups.replaceChildren();

    if (view.mode === "day") {
      renderDayView();
      return;
    }

    renderAllView();
  }

  function renderMoveNotice() {
    if (!moveNotice) {
      moveNoticeEl.hidden = true;
      moveNoticeEl.textContent = "";
      return;
    }
    moveNoticeEl.hidden = false;
    moveNoticeEl.textContent = moveNotice;
  }

  function tripOptionLabel(trip, index) {
    var count = 0;
    var occurrence = 0;
    state.trips.forEach(function (item, itemIndex) {
      if (item.name === trip.name) {
        count += 1;
        if (itemIndex === index) {
          occurrence = count;
        }
      }
    });
    if (count > 1) {
      return trip.name + " (" + occurrence + ")";
    }
    return trip.name;
  }

  function fillTripSelect() {
    var trip = getActiveTrip();
    tripSelect.replaceChildren();
    state.trips.forEach(function (item, index) {
      var option = document.createElement("option");
      option.value = item.id;
      option.textContent = tripOptionLabel(item, index);
      tripSelect.appendChild(option);
    });
    if (trip) {
      tripSelect.value = trip.id;
    }
  }

  function syncTripManage() {
    if (!tripManage || !tripManageToggle) {
      return;
    }
    tripManage.hidden = !tripManageOpen;
    tripManageToggle.setAttribute("aria-expanded", tripManageOpen ? "true" : "false");
    if (tripManageLabel) {
      tripManageLabel.textContent = tripManageOpen ? "여행 관리 접기" : "여행 관리 펼치기";
    }
    var arrow = tripManageToggle.querySelector(".trip-manage-arrow");
    if (arrow) {
      arrow.textContent = tripManageOpen ? "▼" : "▶";
    }
  }

  function renderTripChrome() {
    var trip = getActiveTrip();
    var hasTrip = !!trip;
    currentTripName.hidden = !hasTrip;
    tripCard.hidden = !hasTrip;
    calculator.hidden = !hasTrip;
    noTrip.hidden = hasTrip;

    if (!hasTrip) {
      currentTripName.textContent = "";
      tripSelect.replaceChildren();
      return;
    }

    currentTripName.textContent = trip.name;
    if (document.activeElement !== tripRenameInput) {
      tripRenameInput.value = trip.name;
    }
    fillTripSelect();
    syncTripManage();
  }

  function render() {
    renderTripChrome();
    if (!getActiveTrip()) {
      return;
    }
    renderSummary();
    renderList();
    renderMoveNotice();
    syncQuickExpenses();
  }

  function syncQuickExpenses() {
    var typedName = expenseNameInput.value.trim();
    if (selectedQuickName && typedName !== selectedQuickName) {
      selectedQuickName = "";
    }
    Array.prototype.forEach.call(quickButtons, function (button) {
      var pressed = selectedQuickName !== "" && button.getAttribute("data-quick-name") === selectedQuickName;
      button.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
    quickExpenseBox.hidden = editingId !== null;
  }

  function applyQuickExpense(name) {
    var category = QUICK_CATEGORIES[name];
    if (!category || editingId !== null) {
      return;
    }
    var keptDate = expenseDateInput.value;
    var keptAmount = expenseAmountInput.value;
    selectedQuickName = name;
    expenseNameInput.value = name;
    expenseCategoryInput.value = category;
    expenseDateInput.value = keptDate;
    expenseAmountInput.value = keptAmount;
    clearMessage(expenseError);
    markValid(expenseNameInput);
    syncQuickExpenses();
    expenseAmountInput.focus();
  }

  function createCategorySelect(selectId, selected) {
    var select = document.createElement("select");
    select.id = selectId;
    select.setAttribute("data-edit-category", "true");
    ["식비", "교통비", "숙박비", "기타"].forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      if (category === selected) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    return select;
  }

  function appendEditField(box, labelText, fieldId, control) {
    var label = document.createElement("label");
    label.setAttribute("for", fieldId);
    label.textContent = labelText;
    control.id = fieldId;
    box.appendChild(label);
    box.appendChild(control);
  }

  function isValidMoney(value) {
    return Number.isSafeInteger(value) && value >= 1 && value <= MAX_MONEY;
  }

  function isValidBudget(value) {
    return Number.isSafeInteger(value) && value >= 0 && value <= MAX_MONEY;
  }

  function isValidExpense(item) {
    if (!item || typeof item !== "object") {
      return false;
    }
    if (!Number.isSafeInteger(item.id) || item.id < 1) {
      return false;
    }
    if (typeof item.name !== "string" || item.name.trim() === "" || item.name.trim().length > MAX_NAME) {
      return false;
    }
    if (!CATEGORIES[item.category]) {
      return false;
    }
    return isValidMoney(item.amount);
  }

  function isValidTripId(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);
  }

  function tripNameLimit(name) {
    if (typeof name === "string" && name.slice(-RESTORE_SUFFIX.length) === RESTORE_SUFFIX) {
      return MAX_NAME + RESTORE_SUFFIX.length;
    }
    return MAX_NAME;
  }

  function cleanTripName(name) {
    if (typeof name !== "string") {
      return "";
    }
    var trimmed = name.trim();
    return trimmed.slice(0, tripNameLimit(trimmed));
  }

  function sanitizeExpenses(list) {
    var expenses = [];
    var seenIds = {};
    if (!Array.isArray(list)) {
      return expenses;
    }
    list.forEach(function (item) {
      if (!isValidExpense(item) || seenIds[item.id]) {
        return;
      }
      seenIds[item.id] = true;
      expenses.push({
        id: item.id,
        name: item.name.trim(),
        category: item.category,
        amount: item.amount,
        date: isValidDateString(item.date) ? item.date : null
      });
    });
    return expenses;
  }

  function expenseIdCeiling(trips, storedNextId) {
    var maxId = 0;
    trips.forEach(function (trip) {
      trip.expenses.forEach(function (expense) {
        if (expense.id > maxId) {
          maxId = expense.id;
        }
      });
    });
    if (Number.isSafeInteger(storedNextId) && storedNextId > maxId) {
      return storedNextId;
    }
    return maxId + 1;
  }

  function getStore() {
    if (storageBlocked) {
      return null;
    }
    try {
      if (!window.localStorage) {
        storageBlocked = true;
        return null;
      }
      return window.localStorage;
    } catch (error) {
      storageBlocked = true;
      return null;
    }
  }

  function showStorageWarning() {
    storageBlocked = true;
    storageNotice.hidden = false;
    storageNotice.textContent =
      "기록을 저장하지 못했습니다. 계산은 이 화면에서 계속할 수 있지만, 새로고침하면 저장되지 않은 내용이 사라집니다.";
    footnote.textContent = "지금은 기록을 저장할 수 없습니다. 새로고침하면 저장되지 않은 내용이 사라질 수 있습니다.";
  }

  function readStorageItem(store, key) {
    try {
      return { ok: true, value: store.getItem(key) };
    } catch (error) {
      return { ok: false, value: null };
    }
  }

  function cloneState() {
    return {
      activeTripId: state.activeTripId,
      nextExpenseId: state.nextExpenseId,
      trips: state.trips.map(function (trip) {
        return {
          id: trip.id,
          name: trip.name,
          budget: trip.budget,
          expenses: trip.expenses.map(function (expense) {
            return {
              id: expense.id,
              name: expense.name,
              category: expense.category,
              amount: expense.amount,
              date: expense.date
            };
          })
        };
      })
    };
  }

  function restoreState(snapshot) {
    state.activeTripId = snapshot.activeTripId;
    state.nextExpenseId = snapshot.nextExpenseId;
    state.trips = snapshot.trips;
  }

  function syncBudgetInput() {
    var trip = getActiveTrip();
    if (!trip || trip.budget === null || trip.budget === undefined) {
      budgetInput.value = "";
      return;
    }
    budgetInput.value = formatNumber(trip.budget);
  }

  function resetEntryState() {
    pendingDeleteId = null;
    editingId = null;
    dayEditMode = false;
    moveNotice = "";
    lastAddedId = null;
    view.mode = "all";
    view.date = null;
    expenseNameInput.value = "";
    expenseAmountInput.value = "";
    expenseCategoryInput.value = "식비";
    expenseDateInput.value = todayLocalDate();
    clearMessage(expenseError);
    clearMessage(budgetError);
    clearMessage(budgetSuccess);
    markValid(expenseNameInput);
    markValid(expenseAmountInput);
    markValid(expenseDateInput);
    markValid(budgetInput);
    selectedQuickName = "";
    syncBudgetInput();
    syncQuickExpenses();
  }

  function parseLegacy(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    var expenses = sanitizeExpenses(data.expenses);
    return {
      budget: isValidMoney(data.budget) ? data.budget : null,
      expenses: expenses,
      nextId: expenseIdCeiling([{ expenses: expenses }], data.nextId)
    };
  }

  function parseTripStore(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!data || typeof data !== "object" || !Array.isArray(data.trips)) {
      return null;
    }

    var trips = [];
    var seenIds = {};
    data.trips.forEach(function (item) {
      if (!item || typeof item !== "object" || !isValidTripId(item.id) || seenIds[item.id]) {
        return;
      }
      var name = cleanTripName(item.name);
      if (!name) {
        name = LEGACY_TRIP_NAME;
      }
      seenIds[item.id] = true;
      trips.push({
        id: item.id,
        name: name,
        budget: isValidBudget(item.budget) ? item.budget : null,
        expenses: sanitizeExpenses(item.expenses)
      });
    });

    var activeTripId = null;
    if (trips.length > 0) {
      activeTripId = trips[0].id;
      if (isValidTripId(data.activeTripId) && seenIds[data.activeTripId]) {
        activeTripId = data.activeTripId;
      }
    }

    return {
      trips: trips,
      activeTripId: activeTripId,
      nextExpenseId: expenseIdCeiling(trips, data.nextExpenseId)
    };
  }

  function applyStore(loaded) {
    state.trips = loaded.trips;
    state.activeTripId = loaded.activeTripId;
    state.nextExpenseId = loaded.nextExpenseId;
  }

  function ensureLegacyBackup(store, rawOld) {
    try {
      var existing = store.getItem(BACKUP_KEY);
      if (!existing) {
        store.setItem(BACKUP_KEY, rawOld);
      }
      return store.getItem(LEGACY_KEY) === rawOld;
    } catch (error) {
      return false;
    }
  }

  function loadState() {
    var store = getStore();
    if (!store) {
      showStorageWarning();
      return;
    }

    var fresh = readStorageItem(store, STORAGE_KEY);
    if (!fresh.ok) {
      showStorageWarning();
      return;
    }
    if (fresh.value) {
      var parsed = parseTripStore(fresh.value);
      if (parsed) {
        applyStore(parsed);
        return;
      }
    }

    var legacyRead = readStorageItem(store, LEGACY_KEY);
    if (!legacyRead.ok) {
      showStorageWarning();
      return;
    }
    if (!legacyRead.value) {
      return;
    }

    var legacy = parseLegacy(legacyRead.value);
    if (!legacy) {
      return;
    }

    applyStore({
      trips: [{
        id: "trip-legacy",
        name: LEGACY_TRIP_NAME,
        budget: legacy.budget,
        expenses: legacy.expenses
      }],
      activeTripId: "trip-legacy",
      nextExpenseId: legacy.nextId
    });

    if (!ensureLegacyBackup(store, legacyRead.value)) {
      showStorageWarning();
      return;
    }

    saveState();
  }

  function buildStoredPayload(source) {
    return {
      version: 2,
      activeTripId: source.activeTripId,
      nextExpenseId: source.nextExpenseId,
      trips: source.trips.map(function (trip) {
        return {
          id: trip.id,
          name: trip.name,
          budget: trip.budget,
          expenses: trip.expenses.map(function (expense) {
            return {
              id: expense.id,
              name: expense.name,
              category: expense.category,
              amount: expense.amount,
              date: expense.date || null
            };
          })
        };
      })
    };
  }

  function saveState() {
    var store = getStore();
    if (!store) {
      showStorageWarning();
      return false;
    }

    try {
      store.setItem(STORAGE_KEY, JSON.stringify(buildStoredPayload(state)));
      return true;
    } catch (error) {
      showStorageWarning();
      return false;
    }
  }

  function createTripId() {
    var id = "";
    var exists = true;
    while (exists) {
      id = "trip-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 100000).toString(36);
      exists = false;
      state.trips.forEach(function (trip) {
        if (trip.id === id) {
          exists = true;
        }
      });
    }
    return id;
  }

  function findExpense(id) {
    var found = null;
    getExpenses().forEach(function (expense) {
      if (expense.id === id) {
        found = expense;
      }
    });
    return found;
  }

  function openDialog(dialog, focusElement) {
    dialog.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(function () {
      if (focusElement) {
        focusElement.focus();
      }
    }, 0);
  }

  function closeDialog(dialog) {
    dialog.hidden = true;
    if (newTripDialog.hidden && deleteTripDialog.hidden && restoreDialog.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function focusableIn(dialog) {
    return Array.prototype.slice.call(dialog.querySelectorAll("button, input, select, textarea"))
      .filter(function (element) {
        return !element.disabled && element.tabIndex !== -1;
      });
  }

  function trapFocus(event, dialog) {
    var items = focusableIn(dialog);
    if (items.length === 0) {
      return;
    }
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function cancelNewTrip() {
    newTripNameInput.value = "";
    clearMessage(newTripError);
    markValid(newTripNameInput);
    closeDialog(newTripDialog);
    newTripOpenButton.focus();
  }

  function cancelDeleteTrip() {
    closeDialog(deleteTripDialog);
    tripDeleteOpen.focus();
  }

  function createNewTrip(name) {
    var hadTrip = !!getActiveTrip();
    var snapshot = cloneState();
    var trip = {
      id: createTripId(),
      name: name,
      budget: 0,
      expenses: []
    };
    state.trips.push(trip);
    state.activeTripId = trip.id;
    resetEntryState();
    if (!saveState()) {
      restoreState(snapshot);
      resetEntryState();
      render();
      return false;
    }
    render();
    if (hadTrip) {
      showMessage(tripStatus, "새 여행을 만들었습니다. 이전 여행 기록은 보관되어 있습니다.");
    } else if (tripStatus) {
      showMessage(tripStatus, "새 여행을 만들었습니다.");
    }
    currentTripName.scrollIntoView({ block: "start" });
    return true;
  }

  function deleteActiveTrip() {
    var trip = getActiveTrip();
    if (!trip) {
      return false;
    }
    var snapshot = cloneState();
    var index = 0;
    state.trips.forEach(function (item, itemIndex) {
      if (item.id === trip.id) {
        index = itemIndex;
      }
    });
    var removedId = trip.id;
    state.trips = state.trips.filter(function (item) {
      return item.id !== removedId;
    });
    if (state.trips.length === 0) {
      state.activeTripId = null;
    } else if (index >= state.trips.length) {
      state.activeTripId = state.trips[state.trips.length - 1].id;
    } else {
      state.activeTripId = state.trips[index].id;
    }
    resetEntryState();
    clearMessage(tripStatus);
    if (!saveState()) {
      restoreState(snapshot);
      resetEntryState();
      render();
      return false;
    }
    render();
    return true;
  }

  function saveEdit(item, id) {
    var trip = getActiveTrip();
    if (!trip) {
      return;
    }
    var nameInput = item.querySelector("[data-edit-name]");
    var categoryInput = item.querySelector("[data-edit-category]");
    var dateInput = item.querySelector("[data-edit-date]");
    var amountInput = item.querySelector("[data-edit-amount]");
    var errorBox = item.querySelector("[data-edit-error]");
    var name = nameInput ? nameInput.value.trim() : "";
    var category = categoryInput ? categoryInput.value : "";
    var dateValue = dateInput ? dateInput.value : "";
    var amountResult = parseMoney(amountInput ? amountInput.value : "");
    var problems = [];

    if (name === "") {
      problems.push("항목 이름을 입력해 주세요.");
    }
    if (!CATEGORIES[category]) {
      problems.push("분류를 선택해 주세요.");
    }
    if (!isValidDateString(dateValue)) {
      problems.push("지출 날짜를 선택해 주세요.");
    }
    if (!amountResult.ok) {
      problems.push(moneyErrorMessage(amountResult, "금액을 입력해 주세요.", "12000"));
    }

    if (problems.length > 0) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = problems.join("\n");
      }
      if (name === "" && nameInput) {
        nameInput.focus();
      } else if (!isValidDateString(dateValue) && dateInput) {
        dateInput.focus();
      } else if (amountInput) {
        amountInput.focus();
      }
      return;
    }

    var target = findExpense(id);
    if (!target) {
      return;
    }

    var oldDate = target.date;
    target.name = name;
    target.category = category;
    target.date = dateValue;
    target.amount = amountResult.value;
    editingId = null;

    if (view.mode === "day" && oldDate !== dateValue) {
      moveNotice = "변경한 날짜로 이동했습니다";
    } else {
      moveNotice = "";
    }

    var editSaved = saveState();
    render();
    if (!editSaved) {
      storageNotice.scrollIntoView({ block: "nearest" });
      return;
    }
    if (moveNotice) {
      moveNoticeEl.scrollIntoView({ block: "nearest" });
    }
  }

  budgetInput.addEventListener("input", function () {
    clearMessage(budgetError);
    clearMessage(budgetSuccess);
    markValid(budgetInput);
  });

  expenseNameInput.addEventListener("input", function () {
    clearMessage(expenseError);
    markValid(expenseNameInput);
    markValid(expenseAmountInput);
    syncQuickExpenses();
  });

  quickExpenseBox.addEventListener("click", function (event) {
    var button = event.target.closest("[data-quick-name]");
    if (!button) {
      return;
    }
    event.preventDefault();
    applyQuickExpense(button.getAttribute("data-quick-name"));
  });

  expenseAmountInput.addEventListener("input", function () {
    clearMessage(expenseError);
    markValid(expenseNameInput);
    markValid(expenseAmountInput);
    markValid(expenseDateInput);
  });

  expenseDateInput.addEventListener("input", function () {
    clearMessage(expenseError);
    markValid(expenseDateInput);
  });

  budgetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var trip = getActiveTrip();
    if (!trip) {
      return;
    }

    var result = parseMoney(budgetInput.value);

    if (!result.ok) {
      clearMessage(budgetSuccess);
      showMessage(
        budgetError,
        moneyErrorMessage(result, "여행 전체 예산을 입력해 주세요.", "500000")
      );
      markInvalid(budgetInput, "budget-error");
      budgetInput.focus();
      return;
    }

    trip.budget = result.value;
    budgetInput.value = formatNumber(result.value);
    clearMessage(budgetError);
    clearMessage(budgetSuccess);
    markValid(budgetInput);
    var budgetSaved = saveState();
    render();
    if (!budgetSaved) {
      storageNotice.scrollIntoView({ block: "nearest" });
      return;
    }
    showMessage(budgetSuccess, "여행 전체 예산을 " + formatWon(result.value) + "으로 설정했습니다.");
    summary.scrollIntoView({ block: "nearest" });
  });

  expenseForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var trip = getActiveTrip();
    if (!trip) {
      return;
    }

    var name = expenseNameInput.value.trim();
    var amountResult = parseMoney(expenseAmountInput.value);
    var dateValue = expenseDateInput.value;
    var dateOk = isValidDateString(dateValue);
    var problems = [];

    if (name === "") {
      problems.push("항목 이름을 입력해 주세요.");
    }

    if (!dateOk) {
      problems.push("지출 날짜를 선택해 주세요.");
    }

    if (!amountResult.ok) {
      problems.push(moneyErrorMessage(amountResult, "금액을 입력해 주세요.", "12000"));
    }

    if (problems.length > 0) {
      showMessage(expenseError, problems.join("\n"));
      if (name === "") {
        markInvalid(expenseNameInput, "expense-error");
      } else {
        markValid(expenseNameInput);
      }
      if (!dateOk) {
        markInvalid(expenseDateInput, "expense-error");
      } else {
        markValid(expenseDateInput);
      }
      if (!amountResult.ok) {
        markInvalid(expenseAmountInput, "expense-error");
      } else {
        markValid(expenseAmountInput);
      }
      if (name === "") {
        expenseNameInput.focus();
      } else if (!dateOk) {
        expenseDateInput.focus();
      } else {
        expenseAmountInput.focus();
      }
      return;
    }

    var expense = {
      id: state.nextExpenseId,
      name: name,
      category: expenseCategoryInput.value,
      amount: amountResult.value,
      date: dateValue
    };
    state.nextExpenseId += 1;
    trip.expenses.unshift(expense);
    pendingDeleteId = null;
    editingId = null;
    moveNotice = "";
    lastAddedId = expense.id;
    clearMessage(tripStatus);

    var expenseSaved = saveState();
    expenseNameInput.value = "";
    expenseAmountInput.value = "";
    selectedQuickName = "";
    clearMessage(expenseError);
    markValid(expenseNameInput);
    markValid(expenseAmountInput);
    markValid(expenseDateInput);
    render();
    if (!expenseSaved) {
      storageNotice.scrollIntoView({ block: "nearest" });
      return;
    }
    summary.scrollIntoView({ block: "start" });
  });

  viewAllButton.addEventListener("click", function () {
    view.mode = "all";
    view.date = null;
    moveNotice = "";
    dayEditMode = false;
    editingId = null;
    pendingDeleteId = null;
    render();
  });

  filterDateInput.addEventListener("change", function () {
    dayEditMode = false;
    editingId = null;
    pendingDeleteId = null;
    moveNotice = "";

    if (!isValidDateString(filterDateInput.value)) {
      view.mode = "all";
      view.date = null;
      render();
      return;
    }

    view.mode = "day";
    view.date = filterDateInput.value;
    render();
  });

  expenseGroups.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.action === "toggle-day-edit") {
      dayEditMode = !dayEditMode;
      if (!dayEditMode) {
        editingId = null;
        pendingDeleteId = null;
      }
      render();
      var toggle = expenseGroups.querySelector('[data-action="toggle-day-edit"]');
      if (toggle) {
        toggle.focus();
      }
      return;
    }

    var item = button.closest(".expense-item, .day-line");
    if (!item) {
      return;
    }

    var trip = getActiveTrip();
    if (!trip) {
      return;
    }

    var id = Number(item.dataset.id);
    var action = button.dataset.action;

    if (action === "start-edit") {
      pendingDeleteId = null;
      editingId = id;
      moveNotice = "";
      render();
      var nameField = expenseGroups.querySelector("[data-edit-name]");
      if (nameField) {
        nameField.focus();
      }
      return;
    }

    if (action === "cancel-edit") {
      editingId = null;
      render();
      return;
    }

    if (action === "save-edit") {
      saveEdit(item, id);
      return;
    }

    if (action === "ask-delete") {
      editingId = null;
      pendingDeleteId = id;
      moveNotice = "";
      render();
      var confirmButton = expenseGroups.querySelector('[data-action="confirm-delete"]');
      if (confirmButton) {
        confirmButton.focus();
      }
      return;
    }

    if (action === "cancel-delete") {
      pendingDeleteId = null;
      render();
      return;
    }

    if (action === "assign-date") {
      var dateInput = item.querySelector("[data-assign-input]");
      var dateError = item.querySelector("[data-assign-error]");
      var chosenDate = dateInput ? dateInput.value : "";

      if (!isValidDateString(chosenDate)) {
        if (dateError) {
          dateError.hidden = false;
          dateError.textContent = "지출 날짜를 선택해 주세요.";
        }
        if (dateInput) {
          dateInput.focus();
        }
        return;
      }

      var dated = findExpense(id);
      if (!dated) {
        return;
      }
      dated.date = chosenDate;
      var dateSaved = saveState();
      render();
      if (!dateSaved) {
        storageNotice.scrollIntoView({ block: "nearest" });
      }
      return;
    }

    if (action === "confirm-delete") {
      trip.expenses = trip.expenses.filter(function (expense) {
        return expense.id !== id;
      });
      if (lastAddedId === id) {
        lastAddedId = null;
      }
      editingId = null;
      pendingDeleteId = null;
      moveNotice = "";
      var deleteSaved = saveState();
      render();
      if (!deleteSaved) {
        storageNotice.scrollIntoView({ block: "nearest" });
        return;
      }
      summary.scrollIntoView({ block: "nearest" });
    }
  });

  newTripOpenButton.addEventListener("click", function () {
    clearMessage(newTripError);
    markValid(newTripNameInput);
    newTripNameInput.value = "";
    openDialog(newTripDialog, newTripNameInput);
  });

  newTripCancel.addEventListener("click", cancelNewTrip);

  newTripDialog.addEventListener("click", function (event) {
    if (event.target === newTripDialog) {
      cancelNewTrip();
    }
  });

  newTripNameInput.addEventListener("input", function () {
    clearMessage(newTripError);
    markValid(newTripNameInput);
  });

  newTripForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = newTripNameInput.value.trim();
    if (name === "") {
      showMessage(newTripError, "여행 이름을 입력해 주세요.");
      markInvalid(newTripNameInput, "new-trip-error");
      newTripNameInput.focus();
      return;
    }
    if (name.length > MAX_NAME) {
      showMessage(newTripError, "여행 이름은 30자 이하로 입력해 주세요.");
      markInvalid(newTripNameInput, "new-trip-error");
      newTripNameInput.focus();
      return;
    }
    if (!createNewTrip(name)) {
      showMessage(newTripError, "기록을 저장하지 못했습니다. 새 여행을 만들지 않았고, 기존 기록은 그대로입니다.");
      return;
    }
    newTripNameInput.value = "";
    clearMessage(newTripError);
    markValid(newTripNameInput);
    closeDialog(newTripDialog);
  });

  tripManageToggle.addEventListener("click", function () {
    tripManageOpen = !tripManageOpen;
    syncTripManage();
  });

  tripSelect.addEventListener("change", function () {
    var id = tripSelect.value;
    if (!id || id === state.activeTripId) {
      return;
    }
    var found = false;
    state.trips.forEach(function (trip) {
      if (trip.id === id) {
        found = true;
      }
    });
    if (!found) {
      return;
    }
    state.activeTripId = id;
    resetEntryState();
    clearMessage(tripStatus);
    clearMessage(tripRenameError);
    saveState();
    render();
  });

  tripRenameInput.addEventListener("input", function () {
    clearMessage(tripRenameError);
  });

  tripRenameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      tripRenameButton.click();
    }
  });

  tripRenameButton.addEventListener("click", function () {
    var trip = getActiveTrip();
    if (!trip) {
      return;
    }
    var name = tripRenameInput.value.trim();
    clearMessage(tripRenameError);
    clearMessage(tripStatus);
    if (name === "") {
      showMessage(tripRenameError, "여행 이름을 입력해 주세요.");
      tripRenameInput.focus();
      return;
    }
    if (name.length > tripNameLimit(name)) {
      showMessage(tripRenameError, "여행 이름은 30자 이하로 입력해 주세요. 복원한 여행은 ‘(복원)’까지 35자입니다.");
      tripRenameInput.focus();
      return;
    }
    var previousName = trip.name;
    trip.name = name;
    if (!saveState()) {
      trip.name = previousName;
      tripRenameInput.value = previousName;
      showMessage(tripRenameError, "여행 이름을 저장하지 못했습니다. 이름은 바꾸지 않았습니다.");
      render();
      return;
    }
    showMessage(tripStatus, "여행 이름을 변경했습니다.");
    render();
  });

  tripDeleteOpen.addEventListener("click", function () {
    var trip = getActiveTrip();
    if (!trip) {
      return;
    }
    deleteTripName.textContent = trip.name;
    openDialog(deleteTripDialog, deleteTripCancel);
  });

  deleteTripForm.addEventListener("submit", function (event) {
    event.preventDefault();
    cancelDeleteTrip();
  });

  deleteTripDialog.addEventListener("click", function (event) {
    if (event.target === deleteTripDialog) {
      cancelDeleteTrip();
    }
  });

  deleteTripConfirm.addEventListener("click", function () {
    if (!deleteActiveTrip()) {
      showMessage(tripRenameError, "여행을 삭제하지 못했습니다. 이 여행의 기록은 그대로입니다.");
      closeDialog(deleteTripDialog);
      return;
    }
    closeDialog(deleteTripDialog);
    if (getActiveTrip()) {
      showMessage(tripStatus, "선택한 여행만 삭제했습니다. 다른 여행 기록은 그대로입니다.");
    }
  });

  document.addEventListener("keydown", function (event) {
    var dialog = null;
    if (!newTripDialog.hidden) {
      dialog = newTripDialog;
    } else if (!deleteTripDialog.hidden) {
      dialog = deleteTripDialog;
    } else if (!restoreDialog.hidden) {
      dialog = restoreDialog;
    }
    if (!dialog) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (dialog === newTripDialog) {
        cancelNewTrip();
      } else if (dialog === restoreDialog) {
        cancelRestore();
      } else {
        cancelDeleteTrip();
      }
      return;
    }
    if (event.key === "Tab") {
      trapFocus(event, dialog);
    }
  });

  function pad2(value) {
    return (value < 10 ? "0" : "") + value;
  }

  function backupFileStamp(date) {
    return date.getFullYear()
      + "-" + pad2(date.getMonth() + 1)
      + "-" + pad2(date.getDate())
      + "-" + pad2(date.getHours())
      + pad2(date.getMinutes())
      + pad2(date.getSeconds());
  }

  function backupLocalIso(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset >= 0 ? "+" : "-";
    var abs = Math.abs(offset);
    return date.getFullYear()
      + "-" + pad2(date.getMonth() + 1)
      + "-" + pad2(date.getDate())
      + "T" + pad2(date.getHours())
      + ":" + pad2(date.getMinutes())
      + ":" + pad2(date.getSeconds())
      + sign + pad2(Math.floor(abs / 60))
      + ":" + pad2(abs % 60);
  }

  function readBackupStore() {
    try {
      if (!window.localStorage) {
        return null;
      }
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function inspectExpenseList(expenses) {
    var index;
    if (!Array.isArray(expenses)) {
      return false;
    }
    for (index = 0; index < expenses.length; index += 1) {
      if (!expenses[index] || typeof expenses[index] !== "object" || Array.isArray(expenses[index])) {
        return false;
      }
    }
    return true;
  }

  function inspectStoredTrips(raw) {
    var data;
    var index;
    var trip;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return { ok: false, reason: "damaged" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.trips)) {
      return { ok: false, reason: "damaged" };
    }
    if (data.trips.length === 0) {
      return { ok: false, reason: "empty" };
    }
    for (index = 0; index < data.trips.length; index += 1) {
      trip = data.trips[index];
      if (!trip || typeof trip !== "object" || Array.isArray(trip) || !inspectExpenseList(trip.expenses)) {
        return { ok: false, reason: "damaged" };
      }
    }
    return { ok: true, sourceKey: STORAGE_KEY, data: data };
  }

  function inspectLegacyForBackup(raw) {
    var data;
    var nextId;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return { ok: false, reason: "damaged" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || !inspectExpenseList(data.expenses)) {
      return { ok: false, reason: "damaged" };
    }
    if (data.expenses.length === 0 && typeof data.budget !== "number") {
      return { ok: false, reason: "empty" };
    }
    nextId = 1;
    data.expenses.forEach(function (expense) {
      if (typeof expense.id === "number" && expense.id >= nextId) {
        nextId = expense.id + 1;
      }
    });
    if (typeof data.nextId === "number" && data.nextId > nextId) {
      nextId = data.nextId;
    }
    return {
      ok: true,
      sourceKey: LEGACY_KEY,
      data: {
        version: 2,
        activeTripId: "trip-legacy",
        nextExpenseId: nextId,
        trips: [{
          id: "trip-legacy",
          name: typeof data.name === "string" && data.name ? data.name : LEGACY_TRIP_NAME,
          budget: typeof data.budget === "number" ? data.budget : null,
          expenses: data.expenses
        }]
      }
    };
  }

  function readBackupSource() {
    var store = readBackupStore();
    var fresh;
    var legacy;
    if (!store) {
      return { ok: false, reason: "unavailable" };
    }
    fresh = readStorageItem(store, STORAGE_KEY);
    if (!fresh.ok) {
      return { ok: false, reason: "unavailable" };
    }
    if (fresh.value !== null) {
      if (!fresh.value) {
        return { ok: false, reason: "damaged" };
      }
      return inspectStoredTrips(fresh.value);
    }
    legacy = readStorageItem(store, LEGACY_KEY);
    if (!legacy.ok) {
      return { ok: false, reason: "unavailable" };
    }
    if (legacy.value === null) {
      return { ok: false, reason: "empty" };
    }
    if (!legacy.value) {
      return { ok: false, reason: "damaged" };
    }
    return inspectLegacyForBackup(legacy.value);
  }

  function backupFailureText(reason) {
    if (reason === "empty") {
      return "보관할 여행 기록이 없습니다. 백업 파일을 만들지 않았습니다.";
    }
    if (reason === "damaged") {
      return "저장된 여행 기록을 확인하지 못했습니다. 빈 백업 파일은 만들지 않았습니다.";
    }
    return "기록을 읽지 못했습니다. 백업 파일을 만들지 않았습니다.";
  }

  function showBackupFailure(reason) {
    clearMessage(backupStatus);
    showMessage(backupError, backupFailureText(reason));
  }

  function downloadBackupFile(source) {
    var now = new Date();
    var stamp = backupFileStamp(now);
    var file = {
      appId: "travel-budget",
      appName: "여행 경비 계산기",
      backupVersion: 1,
      backedUpAt: backupLocalIso(now),
      sourceKey: source.sourceKey,
      data: source.data
    };
    var json = JSON.stringify(file);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "여행경비-백업-" + stamp + ".json";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    clearMessage(backupError);
    showMessage(
      backupStatus,
      "백업 파일 다운로드를 시작했어요.\n다운로드 목록에서 확인해 주세요."
    );
  }

  backupButton.addEventListener("click", function () {
    var source = readBackupSource();
    if (!source.ok) {
      showBackupFailure(source.reason);
      return;
    }
    try {
      downloadBackupFile(source);
    } catch (error) {
      showBackupFailure("unavailable");
    }
  });

  function backupTimeLabel(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})[+-](\d{2}):(\d{2})$/.exec(value);
    var hour;
    var minute;
    var second;
    var offsetHour;
    var offsetMinute;
    if (!match || !isValidDateString(match[1] + "-" + match[2] + "-" + match[3])) {
      return "";
    }
    hour = Number(match[4]);
    minute = Number(match[5]);
    second = Number(match[6]);
    offsetHour = Number(match[7]);
    offsetMinute = Number(match[8]);
    if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
      return "";
    }
    return Number(match[1]) + "년 " + Number(match[2]) + "월 " + Number(match[3]) + "일 "
      + match[4] + ":" + match[5] + ":" + match[6];
  }

  function restoreExpenseDate(value) {
    if (value === null || typeof value === "undefined") {
      return { ok: true, date: null };
    }
    if (isValidDateString(value)) {
      return { ok: true, date: value };
    }
    return { ok: false, date: null };
  }

  function validateBackupDocument(file) {
    var data;
    var seenTripIds = {};
    var seenExpenseIds = {};
    var trips = [];
    var tripIndex;
    var trip;
    var tripName;
    var expenseIndex;
    var expense;
    var dateResult;
    var where;
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      return { ok: false, message: "백업 파일의 내용이 올바르지 않습니다." };
    }
    if (file.appId !== "travel-budget" || file.appName !== "여행 경비 계산기") {
      return { ok: false, message: "이 앱의 백업 파일이 아닙니다. 기존 기록은 그대로입니다." };
    }
    if (file.backupVersion !== 1) {
      return { ok: false, message: "지원하지 않는 백업 형식입니다. 이 앱은 형식 버전 1만 불러올 수 있습니다." };
    }
    if (!backupTimeLabel(file.backedUpAt)) {
      return { ok: false, message: "백업 시각이 올바르지 않습니다. 기존 기록은 그대로입니다." };
    }
    if (file.sourceKey !== STORAGE_KEY && file.sourceKey !== LEGACY_KEY) {
      return { ok: false, message: "백업 파일의 저장 정보가 올바르지 않습니다. 기존 기록은 그대로입니다." };
    }
    data = file.data;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== 2 || !Array.isArray(data.trips)) {
      return { ok: false, message: "여행 기록 구조가 올바르지 않습니다. 기존 기록은 그대로입니다." };
    }
    if (!Number.isSafeInteger(data.nextExpenseId) || data.nextExpenseId < 1) {
      return { ok: false, message: "지출 식별자 정보가 올바르지 않습니다. 기존 기록은 그대로입니다." };
    }
    if (data.trips.length === 0) {
      return { ok: false, message: "가져올 여행이 없습니다. 기존 기록은 그대로입니다." };
    }
    for (tripIndex = 0; tripIndex < data.trips.length; tripIndex += 1) {
      trip = data.trips[tripIndex];
      where = (tripIndex + 1) + "번째 여행";
      if (!trip || typeof trip !== "object" || Array.isArray(trip)) {
        return { ok: false, message: where + "의 구조가 올바르지 않습니다. 기존 기록은 그대로입니다." };
      }
      if (!isValidTripId(trip.id) || seenTripIds[trip.id]) {
        return { ok: false, message: where + "의 식별자가 올바르지 않거나 중복되었습니다. 기존 기록은 그대로입니다." };
      }
      seenTripIds[trip.id] = true;
      if (typeof trip.name !== "string" || trip.name !== trip.name.trim() || trip.name === "" || trip.name.length > MAX_NAME) {
        return { ok: false, message: where + "의 이름이 올바르지 않습니다. 이름을 바꾸거나 지우지 않고 불러오기를 멈췄습니다." };
      }
      tripName = trip.name;
      where = "‘" + tripName + "’ 여행";
      if (trip.budget !== null && !isValidBudget(trip.budget)) {
        return { ok: false, message: where + "의 예산이 올바르지 않습니다. 기존 기록은 그대로입니다." };
      }
      if (!Array.isArray(trip.expenses)) {
        return { ok: false, message: where + "의 지출 목록이 올바르지 않습니다. 기존 기록은 그대로입니다." };
      }
      trips.push({
        name: tripName,
        budget: trip.budget,
        expenses: []
      });
      for (expenseIndex = 0; expenseIndex < trip.expenses.length; expenseIndex += 1) {
        expense = trip.expenses[expenseIndex];
        where = "‘" + tripName + "’ 여행의 " + (expenseIndex + 1) + "번째 지출";
        if (!expense || typeof expense !== "object" || Array.isArray(expense)) {
          return { ok: false, message: where + " 구조가 올바르지 않습니다. 잘못된 항목은 빼지 않고 불러오기를 멈췄습니다." };
        }
        if (!Number.isSafeInteger(expense.id) || expense.id < 1 || seenExpenseIds[expense.id]) {
          return { ok: false, message: where + " 식별자가 올바르지 않거나 중복되었습니다. 기존 기록은 그대로입니다." };
        }
        seenExpenseIds[expense.id] = true;
        if (typeof expense.name !== "string" || expense.name !== expense.name.trim() || expense.name === "" || expense.name.length > MAX_NAME) {
          return { ok: false, message: where + " 이름이 올바르지 않습니다. 이름을 고치지 않고 불러오기를 멈췄습니다." };
        }
        if (!CATEGORIES[expense.category]) {
          return { ok: false, message: where + " 분류가 올바르지 않습니다. 식비, 교통비, 숙박비, 기타만 불러올 수 있습니다." };
        }
        if (!isValidMoney(expense.amount)) {
          return { ok: false, message: where + " 금액이 올바르지 않습니다. 1원 이상의 정수만 불러올 수 있습니다." };
        }
        dateResult = restoreExpenseDate(expense.date);
        if (!dateResult.ok) {
          return { ok: false, message: where + " 날짜가 올바르지 않습니다. 날짜가 없는 기록은 빈 날짜만 허용됩니다." };
        }
        trips[trips.length - 1].expenses.push({
          name: expense.name,
          category: expense.category,
          amount: expense.amount,
          date: dateResult.date
        });
      }
    }
    if (typeof data.activeTripId !== "string" || !seenTripIds[data.activeTripId]) {
      return { ok: false, message: "백업 안의 선택 여행 정보가 올바르지 않습니다. 기존 기록은 그대로입니다." };
    }
    return {
      ok: true,
      backedUpAt: file.backedUpAt,
      dateLabel: backupTimeLabel(file.backedUpAt),
      trips: trips
    };
  }

  function expenseContentKey(expense) {
    return expense.name + "\n" + expense.category + "\n" + String(expense.amount) + "\n" + (expense.date || "");
  }

  function tripContentKey(name, budget, expenses) {
    return name + "\n" + String(budget) + "\n" + expenses.map(expenseContentKey).slice().sort().join("\n");
  }

  function findRepeatedRestore(trips) {
    var available = state.trips.map(function (trip) {
      return tripContentKey(trip.name, trip.budget, trip.expenses);
    });
    var matched = [];
    var missing = 0;
    trips.forEach(function (trip) {
      var key = tripContentKey(trip.name + RESTORE_SUFFIX, trip.budget, trip.expenses);
      var index = available.indexOf(key);
      if (index === -1) {
        missing += 1;
        return;
      }
      matched.push(trip.name + RESTORE_SUFFIX);
      available.splice(index, 1);
    });
    return { matched: matched, missing: missing };
  }

  function createTripIdAgainst(trips) {
    var id = "";
    var exists = true;
    while (exists) {
      id = "trip-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 100000).toString(36);
      exists = false;
      trips.forEach(function (trip) {
        if (trip.id === id) {
          exists = true;
        }
      });
    }
    return id;
  }

  function prepareRestoredState(trips) {
    var nextTrips = cloneState().trips;
    var nextExpenseId = expenseIdCeiling(nextTrips, state.nextExpenseId);
    var seenTripIds = {};
    var seenExpenseIds = {};
    var index;
    nextTrips.forEach(function (trip) {
      seenTripIds[trip.id] = true;
      trip.expenses.forEach(function (expense) {
        seenExpenseIds[expense.id] = true;
      });
    });
    for (index = 0; index < trips.length; index += 1) {
      var source = trips[index];
      var restoredName = source.name + RESTORE_SUFFIX;
      var record;
      var expenses = [];
      var expenseIndex;
      if (restoredName.length > tripNameLimit(restoredName)) {
        return { ok: false, message: "‘" + source.name + "’ 여행 이름에 ‘(복원)’을 붙이면 너무 깁니다. 추가하지 않았습니다." };
      }
      record = {
        id: createTripIdAgainst(nextTrips),
        name: restoredName,
        budget: source.budget,
        expenses: expenses
      };
      if (!isValidTripId(record.id) || seenTripIds[record.id]) {
        return { ok: false, message: "새 여행 식별자를 만들지 못했습니다. 기존 기록은 그대로입니다." };
      }
      for (expenseIndex = 0; expenseIndex < source.expenses.length; expenseIndex += 1) {
        var sourceExpense = source.expenses[expenseIndex];
        var expense = {
          id: nextExpenseId,
          name: sourceExpense.name,
          category: sourceExpense.category,
          amount: sourceExpense.amount,
          date: sourceExpense.date
        };
        if (!isValidExpense(expense) || seenExpenseIds[expense.id] || (expense.date !== null && !isValidDateString(expense.date))) {
          return { ok: false, message: "추가할 지출을 확인하지 못했습니다. 기존 기록은 그대로입니다." };
        }
        seenExpenseIds[expense.id] = true;
        expenses.push(expense);
        nextExpenseId += 1;
      }
      seenTripIds[record.id] = true;
      nextTrips.push(record);
    }
    for (index = 0; index < state.trips.length; index += 1) {
      if (JSON.stringify(buildStoredPayload({ activeTripId: null, nextExpenseId: 1, trips: [state.trips[index]] }).trips[0])
        !== JSON.stringify(buildStoredPayload({ activeTripId: null, nextExpenseId: 1, trips: [nextTrips[index]] }).trips[0])) {
        return { ok: false, message: "기존 여행을 확인하지 못했습니다. 추가하지 않았습니다." };
      }
    }
    return {
      ok: true,
      trips: nextTrips,
      nextExpenseId: nextExpenseId,
      activeTripId: state.activeTripId && seenTripIds[state.activeTripId] ? state.activeTripId : nextTrips[0].id
    };
  }

  function writeRestoredPayload(payload) {
    var store;
    var previous;
    var json;
    try {
      if (!window.localStorage) {
        return false;
      }
      store = window.localStorage;
      previous = store.getItem(STORAGE_KEY);
      json = JSON.stringify(payload);
      store.setItem(STORAGE_KEY, json);
      if (store.getItem(STORAGE_KEY) !== json) {
        throw new Error("mismatch");
      }
      return true;
    } catch (error) {
      try {
        if (store && store.getItem(STORAGE_KEY) !== previous) {
          if (previous === null) {
            store.removeItem(STORAGE_KEY);
          } else {
            store.setItem(STORAGE_KEY, previous);
          }
        }
      } catch (restoreError) {
        showStorageWarning();
      }
      return false;
    }
  }

  function commitRestoredTrips(trips) {
    var prepared = prepareRestoredState(trips);
    var payload;
    if (!prepared.ok) {
      return prepared;
    }
    payload = buildStoredPayload({
      activeTripId: prepared.activeTripId,
      nextExpenseId: prepared.nextExpenseId,
      trips: prepared.trips
    });
    if (!writeRestoredPayload(payload)) {
      return { ok: false, message: "기록을 저장하지 못했습니다. 용량이 부족하거나 저장이 막혀 있습니다. 기존 여행은 그대로입니다." };
    }
    state.trips = prepared.trips;
    state.nextExpenseId = prepared.nextExpenseId;
    state.activeTripId = prepared.activeTripId;
    return { ok: true };
  }

  function addRestoreLine(label, value) {
    var line = document.createElement("p");
    line.textContent = label + " " + value;
    restoreSummary.appendChild(line);
  }

  function showRestorePlan(plan) {
    var totalCount = 0;
    var totalAmount = 0;
    restoreSummary.replaceChildren();
    addRestoreLine("백업 날짜", plan.dateLabel);
    addRestoreLine("여행 수", plan.trips.length + "개");
    plan.trips.forEach(function (trip) {
      var line = document.createElement("p");
      line.textContent = trip.name + RESTORE_SUFFIX;
      restoreSummary.appendChild(line);
      totalCount += trip.expenses.length;
      trip.expenses.forEach(function (expense) {
        totalAmount += expense.amount;
      });
    });
    addRestoreLine("전체 지출", totalCount + "건");
    addRestoreLine("지출 합계", formatWon(totalAmount));
    clearMessage(restoreError);
    restoreConfirm.disabled = false;
    restoreBusy = false;
    openDialog(restoreDialog, restoreCancel);
  }

  function cancelRestore() {
    restorePlan = null;
    restoreBusy = false;
    restoreConfirm.disabled = false;
    clearMessage(restoreError);
    closeDialog(restoreDialog);
  }

  function confirmRestore() {
    var plan;
    var result;
    if (restoreBusy || !restorePlan) {
      return;
    }
    restoreBusy = true;
    restoreConfirm.disabled = true;
    plan = restorePlan;
    restorePlan = null;
    result = commitRestoredTrips(plan.trips);
    if (!result.ok) {
      restorePlan = plan;
      restoreBusy = false;
      restoreConfirm.disabled = false;
      showMessage(restoreError, result.message);
      return;
    }
    restoreBusy = false;
    restoreConfirm.disabled = false;
    closeDialog(restoreDialog);
    clearMessage(backupError);
    showMessage(backupStatus, "백업의 여행을 추가했습니다.");
    render();
  }

  function inspectRestoreText(text) {
    var file;
    var plan;
    var repeated;
    try {
      file = JSON.parse(text);
    } catch (error) {
      showMessage(backupError, "파일을 읽었지만 올바른 JSON이 아닙니다. 기존 기록은 그대로입니다.");
      clearMessage(backupStatus);
      return;
    }
    plan = validateBackupDocument(file);
    if (!plan.ok) {
      showMessage(backupError, plan.message);
      clearMessage(backupStatus);
      return;
    }
    repeated = findRepeatedRestore(plan.trips);
    if (repeated.matched.length > 0) {
      showMessage(
        backupError,
        repeated.missing === 0
          ? "이 백업의 여행은 이미 추가되어 있습니다. 다시 추가하지 않았습니다."
          : "같은 내용의 여행이 이미 있습니다: " + repeated.matched.join(", ") + ". 일부만 넣지 않고 추가를 멈췄습니다."
      );
      clearMessage(backupStatus);
      return;
    }
    restorePlan = plan;
    clearMessage(backupError);
    clearMessage(backupStatus);
    showRestorePlan(plan);
  }

  restoreOpenButton.addEventListener("click", function () {
    restoreFileInput.value = "";
    restoreFileInput.click();
  });

  restoreFileInput.addEventListener("change", function () {
    var file = restoreFileInput.files && restoreFileInput.files[0];
    var reader;
    if (restoreDialog && !restoreDialog.hidden) {
      cancelRestore();
    }
    clearMessage(backupStatus);
    clearMessage(backupError);
    if (!file) {
      return;
    }
    reader = new FileReader();
    reader.onload = function () {
      if (typeof reader.result !== "string") {
        showMessage(backupError, "파일을 읽지 못했습니다. 기존 기록은 그대로입니다.");
        return;
      }
      inspectRestoreText(reader.result);
    };
    reader.onerror = function () {
      showMessage(backupError, "파일을 읽지 못했습니다. 기존 기록은 그대로입니다.");
      clearMessage(backupStatus);
    };
    reader.readAsText(file);
  });

  restoreCancel.addEventListener("click", cancelRestore);

  restoreConfirm.addEventListener("click", confirmRestore);

  restoreDialog.addEventListener("click", function (event) {
    if (event.target === restoreDialog) {
      cancelRestore();
    }
  });

  loadState();
  resetEntryState();
  render();
})();
