// חלון קופץ מלמטה (sheet) משותף + אישור
import { el, $ } from "./util.js";
export function openSheet(html, { onClose } = {}){
  closeSheet();
  const scrim = el('<div class="scrim" role="dialog" aria-modal="true"><div class="sheet"><div class="grab" aria-hidden="true"></div>' + html + '</div></div>');
  scrim.addEventListener("click", e => { if (e.target === scrim) closeSheet(); });
  scrim._onClose = onClose;
  document.body.appendChild(scrim); document.body.classList.add("noscroll");
  const first = scrim.querySelector("input,select,textarea,button"); if (first && window.innerWidth > 700) first.focus();
  return scrim.querySelector(".sheet");
}
export function closeSheet(){ const s = $(".scrim"); if (s){ if (s._onClose) s._onClose(); s.remove(); } document.body.classList.remove("noscroll"); }
export function confirmBox(msg, { ok = "כן", danger = false } = {}){
  return new Promise(res => {
    const sh = openSheet('<h2>לאשר?</h2><p class="confirm-msg"></p><div class="row2"><button type="button" class="ghost" data-x="no">ביטול</button><button type="button" class="add ' + (danger ? "danger" : "") + '" data-x="yes" style="margin:0;flex:1"></button></div>', { onClose: () => res(false) });
    sh.querySelector(".confirm-msg").textContent = msg; sh.querySelector("[data-x=yes]").textContent = ok;
    sh.querySelector("[data-x=no]").onclick = () => closeSheet();
    sh.querySelector("[data-x=yes]").onclick = () => { const s = $(".scrim"); s._onClose = null; closeSheet(); res(true); };
  });
}
