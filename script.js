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

  var state = {
    budget: null,
    expenses: [],
    nextId: 1,
    lastAddedId: null
  };

  var pendingDeleteId = null;
  var editingId = null;
  var moveNotice = "";
  var view = {
    mode: "all",
    date: null
  };
  var storageBlocked = false;
  var MAX_MONEY = 1000000000000;
  var STORAGE_KEY = "travel-budget-records";
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

  function getSpent() {
    return state.expenses.reduce(function (sum, expense) {
      return sum + expense.amount;
    }, 0);
  }

  function renderSummary() {
    var spent = getSpent();
    spentValue.textContent = formatWon(spent);

    if (state.budget === null) {
      budgetValue.textContent = "아직 없습니다";
      remainLabel.textContent = "남은 예산";
      remainValue.textContent = "없음";
      remainValue.classList.remove("is-over");
      setGuide("wait", ["여행 전체 예산을 설정하면 남은 돈이 여기에 계산됩니다."]);
      return;
    }

    budgetValue.textContent = formatWon(state.budget);

    if (spent > state.budget) {
      var over = spent - state.budget;
      remainLabel.textContent = "초과 금액";
      remainValue.textContent = formatWon(over);
      remainValue.classList.add("is-over");
      setGuide("over", [
        "초과 금액: " + formatWon(over),
        "여행 전체 예산보다 " + formatWon(over) + "을 더 사용했습니다. 지출 내역을 다시 확인해 주세요."
      ]);
      return;
    }

    var remain = state.budget - spent;
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

    if (expense.id === state.lastAddedId) {
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

    if (expense.id === state.lastAddedId) {
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

    state.expenses.forEach(function (expense) {
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

  function renderAllView() {
    var count = state.expenses.length;
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
    var items = state.expenses.filter(function (expense) {
      return expense.date === view.date;
    });
    var dateLabel = formatKoreanDate(view.date);

    emptyList.hidden = true;
    listCount.textContent = dateLabel + " 지출입니다.";

    if (items.length === 0) {
      dayTotal.hidden = true;
      dayEmpty.hidden = false;
      return;
    }

    dayEmpty.hidden = true;
    dayTotal.hidden = false;
    dayTotal.textContent = "이 날짜 합계: " + formatWon(sumExpenses(items));

    var list = document.createElement("ul");
    list.className = "expense-list";
    items.forEach(function (expense) {
      list.appendChild(createExpenseItem(expense));
    });
    expenseGroups.appendChild(list);
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

  function render() {
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

  function isValidExpense(item) {
    if (!item || typeof item !== "object") {
      return false;
    }
    if (!Number.isSafeInteger(item.id) || item.id < 1) {
      return false;
    }
    if (typeof item.name !== "string" || item.name.trim() === "" || item.name.trim().length > 30) {
      return false;
    }
    if (!CATEGORIES[item.category]) {
      return false;
    }
    return isValidMoney(item.amount);
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
      "기록을 이 브라우저에 저장할 수 없습니다. 계산은 계속할 수 있지만, 새로고침하면 입력한 내용이 사라집니다.";
    footnote.textContent = "지금은 기록을 저장할 수 없습니다. 새로고침하면 입력한 내용이 사라집니다.";
  }

  function loadState() {
    var store = getStore();
    if (!store) {
      showStorageWarning();
      return;
    }

    var raw;
    try {
      raw = store.getItem(STORAGE_KEY);
    } catch (error) {
      showStorageWarning();
      return;
    }

    if (!raw) {
      return;
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return;
    }

    if (!data || typeof data !== "object") {
      return;
    }

    if (isValidMoney(data.budget)) {
      state.budget = data.budget;
      budgetInput.value = formatNumber(data.budget);
    }

    var expenses = [];
    var seenIds = {};
    var maxId = 0;

    if (Array.isArray(data.expenses)) {
      data.expenses.forEach(function (item) {
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
        if (item.id > maxId) {
          maxId = item.id;
        }
      });
    }

    state.expenses = expenses;

    if (Number.isSafeInteger(data.nextId) && data.nextId > maxId) {
      state.nextId = data.nextId;
    } else {
      state.nextId = maxId + 1;
    }
  }

  function saveState() {
    var store = getStore();
    if (!store) {
      showStorageWarning();
      return;
    }

    var payload = {
      budget: state.budget,
      nextId: state.nextId,
      expenses: state.expenses.map(function (expense) {
        return {
          id: expense.id,
          name: expense.name,
          category: expense.category,
          amount: expense.amount,
          date: expense.date || null
        };
      })
    };

    try {
      store.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      showStorageWarning();
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

    state.budget = result.value;
    budgetInput.value = formatNumber(result.value);
    clearMessage(budgetError);
    markValid(budgetInput);
    showMessage(budgetSuccess, "여행 전체 예산을 " + formatWon(result.value) + "으로 설정했습니다.");
    saveState();
    render();
    summary.scrollIntoView({ block: "nearest" });
  });

  expenseForm.addEventListener("submit", function (event) {
    event.preventDefault();

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
      id: state.nextId,
      name: name,
      category: expenseCategoryInput.value,
      amount: amountResult.value,
      date: dateValue
    };

    state.nextId += 1;
    state.lastAddedId = expense.id;
    state.expenses.unshift(expense);
    pendingDeleteId = null;
    editingId = null;
    moveNotice = "";

    expenseNameInput.value = "";
    expenseAmountInput.value = "";
    clearMessage(expenseError);
    markValid(expenseNameInput);
    markValid(expenseAmountInput);
    markValid(expenseDateInput);
    saveState();
    render();
    summary.scrollIntoView({ block: "start" });
  });

  viewAllButton.addEventListener("click", function () {
    view.mode = "all";
    view.date = null;
    moveNotice = "";
    render();
  });

  filterDateInput.addEventListener("change", function () {
    if (!isValidDateString(filterDateInput.value)) {
      view.mode = "all";
      view.date = null;
      moveNotice = "";
      render();
      return;
    }

    view.mode = "day";
    view.date = filterDateInput.value;
    moveNotice = "";
    render();
  });

  expenseGroups.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) {
      return;
    }

    var item = button.closest(".expense-item");
    if (!item) {
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

      state.expenses.forEach(function (expense) {
        if (expense.id === id) {
          expense.date = chosenDate;
        }
      });
      saveState();
      render();
      return;
    }

    if (action === "confirm-delete") {
      state.expenses = state.expenses.filter(function (expense) {
        return expense.id !== id;
      });
      if (state.lastAddedId === id) {
        state.lastAddedId = null;
      }
      editingId = null;
      pendingDeleteId = null;
      moveNotice = "";
      saveState();
      render();
      summary.scrollIntoView({ block: "nearest" });
    }
  });

  function saveEdit(item, id) {
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

    var target = null;
    state.expenses.forEach(function (expense) {
      if (expense.id === id) {
        target = expense;
      }
    });
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

    saveState();
    render();
    if (moveNotice) {
      moveNoticeEl.scrollIntoView({ block: "nearest" });
    }
  }

  loadState();
  expenseDateInput.value = todayLocalDate();
  render();
})();
