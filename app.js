import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

if (!firebaseConfig?.apiKey) {
  throw new Error(
    "Firebase n'est pas configuré. Copiez config.sample.js vers config.js."
  );
}

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const ui = {
  views: {
    login: document.querySelector('[data-view="login"]'),
    form: document.querySelector('[data-view="form"]'),
  },
  sessionLabel: document.querySelector("[data-session-label]"),
  sessionSubtitle: document.querySelector("[data-session-subtitle]"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginForm: document.getElementById("loginForm"),
  listingForm: document.getElementById("listingForm"),
  statusPill: document.querySelector("[data-status-pill]"),
  toast: document.querySelector("[data-toast]"),
  toastTitle: document.querySelector("[data-toast-title]"),
  toastMessage: document.querySelector("[data-toast-message]"),
  resetBtn: document.querySelector("[data-reset-btn]"),
  submitBtn: document.querySelector("[data-submit-btn]"),
  loginBtn: document.querySelector("[data-login-btn]"),
};

let toastTimeout;

const showView = (viewName) => {
  Object.entries(ui.views).forEach(([name, el]) => {
    if (!el) return;
    el.hidden = name !== viewName;
  });
};

const updateSessionCopy = (user) => {
  if (!ui.sessionLabel || !ui.sessionSubtitle) return;
  if (user) {
    ui.sessionLabel.textContent = `Connecté : ${user.email}`;
    ui.sessionSubtitle.textContent = "Vous pouvez publier une annonce.";
  } else {
    ui.sessionLabel.textContent = "Session hors ligne";
    ui.sessionSubtitle.textContent =
      "Connectez-vous pour accéder au formulaire.";
  }
};

const setStatusPill = (text, variant = "idle") => {
  if (!ui.statusPill) return;
  ui.statusPill.textContent = text;
  ui.statusPill.style.borderColor =
    variant === "success"
      ? "rgba(76,217,100,0.6)"
      : variant === "error"
      ? "rgba(255,69,58,0.6)"
      : "rgba(255,255,255,0.35)";
  ui.statusPill.style.color =
    variant === "success"
      ? "rgba(76,217,100,0.9)"
      : variant === "error"
      ? "rgba(255,99,71,0.9)"
      : "#fff";
};

const toggleLoading = (form, isLoading, button) => {
  if (!form) return;
  if (isLoading) {
    form.setAttribute("aria-busy", "true");
  } else {
    form.removeAttribute("aria-busy");
  }
  if (button) {
    if (!button.dataset.default) {
      button.dataset.default = button.textContent;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? "Patientez..." : button.dataset.default;
  }
};

const showToast = (title, message, variant = "success") => {
  if (!ui.toast || !ui.toastTitle || !ui.toastMessage) return;
  ui.toast.hidden = false;
  ui.toast.classList.toggle("success", variant === "success");
  ui.toast.classList.toggle("error", variant === "error");
  ui.toastTitle.textContent = title;
  ui.toastMessage.textContent = message;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    ui.toast.hidden = true;
  }, 4000);
};

const parseImageUrls = (rawValue) => {
  if (typeof rawValue !== "string" || rawValue.trim() === "") return [];
  return rawValue
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
};

const sanitizeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getText = (formData, key) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const buildListingPayload = (formData, userId) => {
  const imageURLs = parseImageUrls(formData.get("imageURLs"));
  return {
    title: getText(formData, "title"),
    price: sanitizeNumber(formData.get("price")),
    address: getText(formData, "address"),
    city: getText(formData, "city"),
    postalCode: getText(formData, "postalCode"),
    type: getText(formData, "type") || "T2",
    surface: sanitizeNumber(formData.get("surface")),
    description: getText(formData, "description"),
    agencyName: getText(formData, "agencyName"),
    agencyEmail: getText(formData, "agencyEmail"),
    agencyPhone: getText(formData, "agencyPhone"),
    imageURL: imageURLs.length ? imageURLs[0] : null,
    imageURLs: imageURLs.length ? imageURLs : null,
    createdAt: serverTimestamp(),
    userId,
  };
};

const handleLogin = async (event) => {
  event.preventDefault();
  if (!ui.loginForm || !ui.loginBtn) return;
  const formData = new FormData(ui.loginForm);
  const email = formData.get("email");
  const password = formData.get("password");
  ui.loginBtn.dataset.default =
    ui.loginBtn.dataset.default || ui.loginBtn.textContent;
  toggleLoading(ui.loginForm, true, ui.loginBtn);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Connexion réussie", "Bienvenue sur le portail Hown.");
  } catch (error) {
    showToast(
      "Connexion impossible",
      error.message || "Vérifiez vos identifiants.",
      "error"
    );
  } finally {
    toggleLoading(ui.loginForm, false, ui.loginBtn);
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    showToast("Déconnecté", "Vous pouvez fermer l'onglet en toute sécurité.");
  } catch (error) {
    showToast(
      "Erreur de déconnexion",
      error.message || "Merci de réessayer.",
      "error"
    );
  }
};

const handleListingSubmit = async (event) => {
  event.preventDefault();
  if (!ui.listingForm || !ui.submitBtn) return;
  if (!auth.currentUser) {
    showToast("Session expirée", "Reconnectez-vous pour publier.", "error");
    showView("login");
    return;
  }

  const formData = new FormData(ui.listingForm);
  ui.submitBtn.dataset.default =
    ui.submitBtn.dataset.default || ui.submitBtn.textContent;
  toggleLoading(ui.listingForm, true, ui.submitBtn);
  setStatusPill("Envoi...", "idle");

  try {
    const payload = buildListingPayload(formData, auth.currentUser.uid);
    await addDoc(collection(db, "listings"), payload);
    ui.listingForm.reset();
    setStatusPill("Annonce publiée", "success");
    showToast("Succès", "Annonce ajoutée à Firestore.");
  } catch (error) {
    console.error(error);
    setStatusPill("Erreur", "error");
    showToast(
      "Publication impossible",
      error.message || "Merci de vérifier les champs.",
      "error"
    );
  } finally {
    toggleLoading(ui.listingForm, false, ui.submitBtn);
  }
};

const handleReset = () => {
  ui.listingForm?.reset();
  setStatusPill("Brouillon");
};

const init = () => {
  if (ui.loginForm) {
    ui.loginForm.addEventListener("submit", handleLogin);
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", handleLogout);
  }
  if (ui.listingForm) {
    ui.listingForm.addEventListener("submit", handleListingSubmit);
  }
  if (ui.resetBtn) {
    ui.resetBtn.addEventListener("click", handleReset);
  }

  onAuthStateChanged(auth, (user) => {
    updateSessionCopy(user);
    if (ui.logoutBtn) {
      ui.logoutBtn.hidden = !user;
    }
    if (user) {
      showView("form");
      setStatusPill("Brouillon");
    } else {
      showView("login");
    }
  });
};

init();

