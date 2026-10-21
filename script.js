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

  function cleanTripName(name) {
    if (typeof name !== "string") {
      return "";
    }
    return name.trim().slice(0, MAX_NAME);
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
    syncBudgetInput();
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

  function saveState() {
    var store = getStore();
    if (!store) {
      showStorageWarning();
      return false;
    }

    var payload = {
      version: 2,
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
              date: expense.date || null
            };
          })
        };
      })
    };

    try {
      store.setItem(STORAGE_KEY, JSON.stringify(payload));
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
    if (newTripDialog.hidden && deleteTripDialog.hidden) {
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
    if (name.length > MAX_NAME) {
      showMessage(tripRenameError, "여행 이름은 30자 이하로 입력해 주세요.");
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
    }
    if (!dialog) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (dialog === newTripDialog) {
        cancelNewTrip();
      } else {
        cancelDeleteTrip();
      }
      return;
    }
    if (event.key === "Tab") {
      trapFocus(event, dialog);
    }
  });

  loadState();
  resetEntryState();
  render();
})();
