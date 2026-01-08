// Récupère l'id depuis l'URL (ex: ?id=2)
const params = new URLSearchParams(window.location.search);
const idBenevole = params.get("id");

const tableBody = document.getElementById("historique-body");
const h2 = document.getElementById("nomBenevole");
const totauxContainer = document.getElementById("totauxBenevoles");

// Points par type de déchet
const pointsParType = {
  "megots": 10,
  "plastique": 30,
  "verre": 20,
  "peche": 15,
  "cannette": 15
};

// Si aucun ID n'est fourni dans l'URL
if (!idBenevole) {
  h2.textContent = "❌ ID de bénévole non fourni dans l'URL";
  tableBody.innerHTML = `<tr><td colspan="5" class="error-message">Impossible de charger les données.</td></tr>`;
} else {
  loadBenevoleHistorique(idBenevole);
}

// ⚡ Fonction pour charger et afficher l'historique du bénévole
async function loadBenevoleHistorique(idBenevole) {
  try {
    // 1️⃣ Récupérer les infos du bénévole
    const resBenevole = await fetch(`http://localhost:3000/benevoles/${idBenevole}`);
    if (!resBenevole.ok) throw new Error("Erreur API bénévole");

    const benevole = await resBenevole.json();
    if (!benevole.nom) {
      h2.textContent = "❌ Bénévole introuvable";
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Bénévole introuvable</td></tr>`;
      return;
    }

    const villeBenevole = benevole.ville || "Inconnue";
    const nomComplet = benevole.prenom ? `${benevole.prenom} ${benevole.nom}` : benevole.nom;
    h2.textContent = nomComplet;
    
    // Mettre à jour l'image du header avec les initiales
    updateHeaderImage(benevole);

    // 2️⃣ Récupérer toutes les collectes
    const resCollectes = await fetch("http://localhost:3000/collectes");
    if (!resCollectes.ok) throw new Error("Erreur API collectes");
    const collectes = await resCollectes.json();

    // 3️⃣ Filtrer les collectes du bénévole
    const collectesFiltrees = collectes.filter(c => String(c.id_benevole) === String(idBenevole));

    if (collectesFiltrees.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="icon">📊</div>
            <h3>Aucune collecte</h3>
            <p>Ce bénévole n'a pas encore de collectes enregistrées</p>
          </td>
        </tr>
      `;
      updateTotaux([], benevole);
      return;
    }

    // 4️⃣ Afficher les collectes
    tableBody.innerHTML = "";
    for (const c of collectesFiltrees) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(c.date).toLocaleDateString('fr-FR')}</td>
        <td>${c.type_dechet}</td>
        <td>
          <div class="quantite-controls">
            <button class="moins" ${c.quantite === 0 ? 'disabled' : ''}>-</button>
            <span class="quantite">${c.quantite}</span>
            <button class="plus">+</button>
          </div>
        </td>
        <td class="points">${c.points_dechet}</td>
        <td>${villeBenevole}</td>
      `;
      tableBody.appendChild(row);

      // Gestion des boutons + et -
      const btnPlus = row.querySelector(".plus");
      const btnMoins = row.querySelector(".moins");
      const spanQuantite = row.querySelector(".quantite");
      const tdPoints = row.querySelector(".points");

      btnPlus.addEventListener("click", async () => {
        let quantite = Number(spanQuantite.innerText) + 1;
        spanQuantite.innerText = quantite;
        const nouveauxPoints = quantite * pointsParType[c.type_dechet];
        tdPoints.innerText = nouveauxPoints;
        btnMoins.disabled = false;
        
        // Animation du bouton
        btnPlus.style.transform = "scale(1.1)";
        setTimeout(() => { btnPlus.style.transform = "scale(1)"; }, 150);
        
        await updateCollecte(c.id, quantite, nouveauxPoints);
        await recalculerTotaux(idBenevole);
        showTempMessage("Collecte mise à jour !", "success");
      });

      btnMoins.addEventListener("click", async () => {
        let quantite = Number(spanQuantite.innerText);
        if (quantite > 1) {
          quantite -= 1;
          spanQuantite.innerText = quantite;
          const nouveauxPoints = quantite * pointsParType[c.type_dechet];
          tdPoints.innerText = nouveauxPoints;
        } else if (quantite === 1) {
          quantite = 0;
          spanQuantite.innerText = quantite;
          tdPoints.innerText = 0;
          btnMoins.disabled = true;
        }
        
        // Animation du bouton
        btnMoins.style.transform = "scale(1.1)";
        setTimeout(() => { btnMoins.style.transform = "scale(1)"; }, 150);
        
        await updateCollecte(c.id, quantite, quantite * pointsParType[c.type_dechet]);
        await recalculerTotaux(idBenevole);
        showTempMessage("Collecte mise à jour !", "success");
      });
    }

    // 5️⃣ Afficher les totaux
    updateTotaux(collectesFiltrees, benevole);

  } catch (err) {
    console.error("Erreur :", err);
    h2.textContent = "❌ Erreur lors du chargement";
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="error-message">
          <div class="icon">⚠️</div>
          <h3>Erreur de chargement</h3>
          <p>Impossible d'afficher les données</p>
        </td>
      </tr>
    `;
  }
}

// 🎨 Mettre à jour l'image du header avec les initiales
function updateHeaderImage(benevole) {
  const headerImage = document.querySelector('.header-image .icon-placeholder');
  if (headerImage && benevole.prenom && benevole.nom) {
    const initiales = (benevole.prenom.charAt(0) + benevole.nom.charAt(0)).toUpperCase();
    headerImage.textContent = initiales;
    headerImage.style.fontSize = '1.5rem';
    headerImage.style.fontWeight = 'bold';
  }
}

// 📊 Mettre à jour les totaux affichés
function updateTotaux(collectes, benevole) {
  if (!totauxContainer) return;

  const totalCollectes = collectes.length;
  const totalDechets = collectes.reduce((sum, c) => sum + (c.quantite || 0), 0);
  const totalPoints = collectes.reduce((sum, c) => sum + (c.points_dechet || 0), 0);

  totauxContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: center;">
      <div style="background: rgba(39, 174, 96, 0.1); padding: 12px; border-radius: 12px;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${totalCollectes}</div>
        <div style="font-size: 0.8rem; color: #666;">Collectes</div>
      </div>
      <div style="background: rgba(52, 152, 219, 0.1); padding: 12px; border-radius: 12px;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--secondary);">${totalDechets}</div>
        <div style="font-size: 0.8rem; color: #666;">Déchets</div>
      </div>
      <div style="background: rgba(241, 196, 15, 0.1); padding: 12px; border-radius: 12px; grid-column: span 2;">
        <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent);">${totalPoints}</div>
        <div style="font-size: 0.9rem; color: #666;">Points totaux</div>
      </div>
    </div>
  `;
}

// 🔄 Recalculer les totaux après modification
async function recalculerTotaux(idBenevole) {
  try {
    const resCollectes = await fetch("http://localhost:3000/collectes");
    if (!resCollectes.ok) return;
    
    const collectes = await resCollectes.json();
    const collectesFiltrees = collectes.filter(c => String(c.id_benevole) === String(idBenevole));
    
    const resBenevole = await fetch(`http://localhost:3000/benevoles/${idBenevole}`);
    if (!resBenevole.ok) return;
    
    const benevole = await resBenevole.json();
    updateTotaux(collectesFiltrees, benevole);
  } catch (err) {
    console.error("Erreur recalcul totaux:", err);
  }
}

// ⚙️ Met à jour la collecte côté backend
async function updateCollecte(id_collecte, nouvelle_quantite, nouveaux_points) {
  try {
    // Méthode 1: Essayer PUT directement sur la collecte
    const response = await fetch(`http://localhost:3000/collectes/${id_collecte}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantite: nouvelle_quantite,
        points_dechet: nouveaux_points
      })
    });

    if (response.ok) {
      return await response.json();
    }

    // Méthode 2: Si PUT échoue, essayer PATCH
    const responsePatch = await fetch(`http://localhost:3000/collectes/${id_collecte}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantite: nouvelle_quantite,
        points_dechet: nouveaux_points
      })
    });

    if (responsePatch.ok) {
      return await responsePatch.json();
    }

    // Méthode 3: Si les deux échouent, essayer POST vers un endpoint update
    const responsePost = await fetch("http://localhost:3000/collectes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_collecte: id_collecte,
        quantite: nouvelle_quantite,
        points_dechet: nouveaux_points
      })
    });

    if (responsePost.ok) {
      return await responsePost.json();
    }

    throw new Error("Toutes les méthodes de mise à jour ont échoué");

  } catch (err) {
    console.error("Erreur mise à jour collecte :", err);
    showTempMessage("Erreur de synchronisation", "error");
    throw err; // Propager l'erreur pour que l'UI puisse revenir en arrière si nécessaire
  }
}

// 🔢 Mettre à jour les points totaux du bénévole (optionnel)
async function updatePointsBenevole(id_benevole) {
  try {
    // Récupérer toutes les collectes du bénévole
    const resCollectes = await fetch("http://localhost:3000/collectes");
    if (!resCollectes.ok) return;
    
    const collectes = await resCollectes.json();
    const collectesBenevole = collectes.filter(c => String(c.id_benevole) === String(id_benevole));
    
    // Calculer les nouveaux totaux
    const totalPoints = collectesBenevole.reduce((sum, c) => sum + (c.points_dechet || 0), 0);
    const totalDechets = collectesBenevole.reduce((sum, c) => sum + (c.quantite || 0), 0);

    // Récupérer les données actuelles du bénévole
    const resBenevole = await fetch(`http://localhost:3000/benevoles/${id_benevole}`);
    if (!resBenevole.ok) return;
    
    const benevole = await resBenevole.json();

    // Mettre à jour le bénévole
    await fetch(`http://localhost:3000/benevoles/${id_benevole}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...benevole,
        nbr_points: totalPoints,
        nbr_dechets: totalDechets
      })
    });

  } catch (err) {
    console.error("Erreur mise à jour points bénévole:", err);
  }
}

// 💫 Afficher un message temporaire
function showTempMessage(message, type = "info") {
  // Supprimer les messages existants
  const existingMessages = document.querySelectorAll('.temp-message');
  existingMessages.forEach(msg => msg.remove());

  const messageEl = document.createElement("div");
  messageEl.textContent = message;
  messageEl.className = 'temp-message';
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "error" ? "var(--error)" : type === "success" ? "var(--success)" : "var(--primary)"};
    color: white;
    padding: 12px 20px;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    z-index: 1000;
    animation: slideInRight 0.3s ease;
    font-weight: 600;
  `;

  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl);
      }
    }, 300);
  }, 2000);
}

// Ajouter les animations CSS pour les messages
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// 🎯 Version simplifiée si les autres méthodes échouent
async function updateCollecteSimple(id_collecte, quantite, points) {
  try {
    // Essayer plusieurs méthodes courantes
    const methods = [
      { method: 'PUT', url: `http://localhost:3000/collectes/${id_collecte}` },
      { method: 'PATCH', url: `http://localhost:3000/collectes/${id_collecte}` },
      { method: 'POST', url: 'http://localhost:3000/updateCollecte' },
      { method: 'POST', url: 'http://localhost:3000/collectes/update' }
    ];

    for (const config of methods) {
      try {
        const response = await fetch(config.url, {
          method: config.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: id_collecte,
            quantite: quantite,
            points_dechet: points
          })
        });

        if (response.ok) {
          console.log(`Mise à jour réussie avec ${config.method} sur ${config.url}`);
          return await response.json();
        }
      } catch (err) {
        console.log(`Échec avec ${config.method} sur ${config.url}:`, err.message);
        continue;
      }
    }

    throw new Error("Aucune méthode de mise à jour n'a fonctionné");

  } catch (err) {
    console.error("Erreur mise à jour collecte simple:", err);
    showTempMessage("Mise à jour échouée", "error");
  }
}

// 🔄 Gestion du rafraîchissement
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchmove', (e) => {
  const touchY = e.touches[0].clientY;
  const diff = touchY - touchStartY;
  
  if (diff > 100 && window.scrollY === 0) {
    loadBenevoleHistorique(idBenevole);
    touchStartY = 0;
  }
});

// Recharger les données si on revient sur la page
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && idBenevole) {
    loadBenevoleHistorique(idBenevole);
  }
});