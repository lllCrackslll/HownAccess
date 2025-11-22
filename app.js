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
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
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
    dashboard: document.querySelector('[data-view="dashboard"]'),
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
  listingsContainer: document.querySelector("[data-listings]"),
  listingCount: document.querySelector("[data-listing-count]"),
  formSubtitle: document.querySelector("[data-form-subtitle]"),
};

let toastTimeout;
let unsubscribeListings;
let editingListingId = null;

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
    ui.sessionSubtitle.textContent = "Gestion des annonces disponible.";
  } else {
    ui.sessionLabel.textContent = "Session hors ligne";
    ui.sessionSubtitle.textContent =
      "Connectez-vous pour accéder au tableau de bord.";
  }
};

const setStatusPill = (text, variant = "idle") => {
  if (!ui.statusPill) return;
  ui.statusPill.textContent = text;
  const colors = {
    success: { border: "rgba(76,217,100,0.6)", text: "rgba(76,217,100,0.9)" },
    error: { border: "rgba(255,69,58,0.6)", text: "rgba(255,99,71,0.9)" },
    idle: { border: "rgba(255,255,255,0.35)", text: "#fff" },
  };
  const palette = colors[variant] || colors.idle;
  ui.statusPill.style.borderColor = palette.border;
  ui.statusPill.style.color = palette.text;
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
    userId,
  };
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  return value instanceof Date ? value : new Date(value);
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
};

const renderListings = (items = []) => {
  if (!ui.listingsContainer) return;
  ui.listingsContainer.innerHTML = "";
  if (ui.listingCount) {
    ui.listingCount.textContent =
      items.length <= 1 ? `${items.length} annonce` : `${items.length} annonces`;
  }

  if (!items.length) {
    ui.listingsContainer.innerHTML =
      '<p class="empty-state">Aucune annonce pour le moment.</p>';
    return;
  }

  items.forEach((listing) => {
    const row = document.createElement("div");
    row.className = "listing-row";

    const createdLabel = formatDate(listing.createdAt);
    const meta = [
      [listing.city, listing.postalCode].filter(Boolean).join(" "),
      listing.type,
      `${listing.surface ?? 0} m²`,
    ]
      .filter(Boolean)
      .join(" • ");

    row.innerHTML = `
      <div class="listing-info">
        <p class="listing-title">${listing.title || "Sans titre"}</p>
        <p class="listing-meta">${meta || "—"}</p>
        <p class="listing-meta">${formatPrice(listing.price)} • Ajoutée le ${createdLabel}</p>
      </div>
      <div class="listing-actions">
        <button type="button" class="ghost-btn" data-edit>Modifier</button>
        <button type="button" class="danger-btn" data-delete>Supprimer</button>
      </div>
    `;

    row.querySelector("[data-edit]")?.addEventListener("click", () =>
      loadListingIntoForm(listing)
    );
    row.querySelector("[data-delete]")?.addEventListener("click", () =>
      handleDeleteListing(listing)
    );

    ui.listingsContainer.appendChild(row);
  });
};

const startListingsListener = () => {
  if (unsubscribeListings) {
    unsubscribeListings();
  }
  const listingsRef = collection(db, "listings");
  const listingsQuery = query(listingsRef, orderBy("createdAt", "desc"));
  unsubscribeListings = onSnapshot(
    listingsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderListings(items);
    },
    (error) => {
      console.error(error);
      showToast(
        "Chargement impossible",
        error.message || "Vérifiez vos règles Firestore.",
        "error"
      );
    }
  );
};

const stopListingsListener = () => {
  if (unsubscribeListings) {
    unsubscribeListings();
    unsubscribeListings = null;
  }
  renderListings([]);
};

const loadListingIntoForm = (listing) => {
  if (!ui.listingForm) return;
  const { elements } = ui.listingForm;

  const setValue = (name, value = "") => {
    const field = elements.namedItem(name);
    if (!field) return;
    field.value = value ?? "";
  };

  setValue("title", listing.title || "");
  setValue("price", listing.price ?? "");
  setValue("surface", listing.surface ?? "");
  setValue("city", listing.city || "");
  setValue("postalCode", listing.postalCode || "");
  setValue("address", listing.address || "");
  setValue("type", listing.type || "T2");
  setValue("description", listing.description || "");
  setValue("agencyName", listing.agencyName || "");
  setValue("agencyEmail", listing.agencyEmail || "");
  setValue("agencyPhone", listing.agencyPhone || "");

  const imageField = elements.namedItem("imageURLs");
  if (imageField) {
    const urls =
      Array.isArray(listing.imageURLs) && listing.imageURLs.length
        ? listing.imageURLs
        : listing.imageURL
        ? [listing.imageURL]
        : [];
    imageField.value = urls.join("\n");
  }

  editingListingId = listing.id;
  if (ui.submitBtn) {
    ui.submitBtn.textContent = "Mettre à jour l'annonce";
  }
  if (ui.formSubtitle) {
    ui.formSubtitle.textContent = `Modification de « ${
      listing.title || "Annonce"
    } »`;
  }
  setStatusPill("Modification en cours", "idle");
  ui.listingForm.scrollIntoView({ behavior: "smooth", block: "center" });
};

const resetFormState = () => {
  if (ui.listingForm) {
    ui.listingForm.reset();
  }
  editingListingId = null;
  if (ui.submitBtn) {
    ui.submitBtn.textContent = "Publier l'annonce";
  }
  if (ui.formSubtitle) {
    ui.formSubtitle.textContent = "Créez ou mettez à jour une annonce.";
  }
  setStatusPill("Brouillon");
};

const handleLogin = async (event) => {
  event.preventDefault();
  if (!ui.loginForm || !ui.loginBtn) return;
  const formData = new FormData(ui.loginForm);
  const email = formData.get("email");
  const password = formData.get("password");
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
    resetFormState();
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
  toggleLoading(ui.listingForm, true, ui.submitBtn);
  setStatusPill("Envoi...", "idle");

  try {
    const payload = buildListingPayload(formData, auth.currentUser.uid);
    if (editingListingId) {
      const docRef = doc(db, "listings", editingListingId);
      await updateDoc(docRef, { ...payload, updatedAt: serverTimestamp() });
      showToast("Annonce mise à jour", "Les modifications sont sauvegardées.");
    } else {
      await addDoc(collection(db, "listings"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      showToast("Succès", "Annonce ajoutée à Firestore.");
    }
    resetFormState();
    setStatusPill("Annonce synchronisée", "success");
  } catch (error) {
    console.error(error);
    setStatusPill("Erreur", "error");
    showToast(
      editingListingId ? "Mise à jour impossible" : "Publication impossible",
      error.message || "Merci de vérifier les champs.",
      "error"
    );
  } finally {
    toggleLoading(ui.listingForm, false, ui.submitBtn);
  }
};

const handleDeleteListing = async (listing) => {
  if (!listing?.id) return;
  const confirmation = confirm(
    `Supprimer l'annonce "${listing.title || listing.id}" ?`
  );
  if (!confirmation) return;
  try {
    await deleteDoc(doc(db, "listings", listing.id));
    showToast("Annonce supprimée", "Elle n'apparaîtra plus dans l'app.");
    if (editingListingId === listing.id) {
      resetFormState();
    }
  } catch (error) {
    console.error(error);
    showToast(
      "Suppression impossible",
      error.message || "Vérifiez vos permissions.",
      "error"
    );
  }
};

const handleReset = () => {
  resetFormState();
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
      showView("dashboard");
      setStatusPill("Brouillon");
      startListingsListener();
    } else {
      showView("login");
      stopListingsListener();
    }
  });
};

init();

