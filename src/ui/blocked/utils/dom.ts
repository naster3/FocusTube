export type BlockedDom = {
  messageEl: HTMLElement | null;
  attemptsEl: HTMLElement | null;
  lastAttemptEl: HTMLElement | null;
  blockedUrlEl: HTMLElement | null;
  blockedUrlLabelEl: HTMLElement | null;
  copyUrlBtn: HTMLButtonElement | null;
  unblockBtn: HTMLButtonElement | null;
  closeBtn: HTMLButtonElement | null;
  blockedTagEl: HTMLElement | null;
  blockedTitleEl: HTMLElement | null;
  attemptsLabelEl: HTMLElement | null;
  lastAttemptLabelEl: HTMLElement | null;
  blockedReasonLabelEl: HTMLElement | null;
  blockedReasonEl: HTMLElement | null;
  carryoverNoteEl: HTMLElement | null;
  confirmModalEl: HTMLElement | null;
  confirmTitleEl: HTMLElement | null;
  confirmDescEl: HTMLElement | null;
  confirmCancelBtn: HTMLButtonElement | null;
  confirmConfirmBtn: HTMLButtonElement | null;
};

export function getBlockedElements(): BlockedDom {
  return {
    messageEl: document.getElementById("message"),
    attemptsEl: document.getElementById("attempts"),
    lastAttemptEl: document.getElementById("last-attempt"),
    blockedUrlEl: document.getElementById("blocked-url"),
    blockedUrlLabelEl: document.getElementById("blocked-url-label"),
    copyUrlBtn: document.getElementById("copy-url-btn") as HTMLButtonElement | null,
    unblockBtn: document.getElementById("unblock-btn") as HTMLButtonElement | null,
    closeBtn: document.getElementById("close-btn") as HTMLButtonElement | null,
    blockedTagEl: document.getElementById("blocked-tag"),
    blockedTitleEl: document.getElementById("blocked-title"),
    attemptsLabelEl: document.getElementById("attempts-label"),
    lastAttemptLabelEl: document.getElementById("last-attempt-label"),
    blockedReasonLabelEl: document.getElementById("blocked-reason-label"),
    blockedReasonEl: document.getElementById("blocked-reason"),
    carryoverNoteEl: document.getElementById("carryover-note"),
    confirmModalEl: document.getElementById("confirm-modal"),
    confirmTitleEl: document.getElementById("confirm-title"),
    confirmDescEl: document.getElementById("confirm-desc"),
    confirmCancelBtn: document.getElementById("confirm-cancel") as HTMLButtonElement | null,
    confirmConfirmBtn: document.getElementById("confirm-confirm") as HTMLButtonElement | null,
  };
}
