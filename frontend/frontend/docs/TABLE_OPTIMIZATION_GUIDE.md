# Guide d'Optimisation des Tableaux

## ✅ Changements Globaux (Automatiques)

Les styles CSS globaux ont été ajoutés dans `index.css`. Tous les éléments avec `overflow-auto` ou `overflow-y-auto` ont maintenant des **scrollbars fines (6px)** automatiquement.

## 🎯 Optimisations Appliquées

### 1. Scrollbars fines (CSS Global)
```css
/* Tous ces éléments ont des scrollbars fines automatiquement */
<div className="overflow-auto">...</div>
<div className="overflow-y-auto">...</div>
<div style={{overflow: 'auto'}}>...</div>
```

### 2. Headers Compacts (Classes utilitaires)
```tsx
// Utiliser ces classes pour des headers compacts
<div className="page-header-compact">
  <h1>Titre de la page</h1>
</div>

// Tableau compact
<table className="table-compact">...</table>
```

### 3. Composants Réutilisables

#### Option A: PageWithTable (Recommandé)
```tsx
import { PageWithTable } from '../components/common';

<PageWithTable
  title="Mes Commandes"
  subtitle="12 commandes en attente"
  actions={<button>Nouveau</button>}
  compact  // Header compact
>
  <table className="table w-full">...</table>
</PageWithTable>
```

#### Option B: DataTableOptimized (Complet)
```tsx
import { DataTableOptimized } from '../components/common';

<DataTableOptimized
  data={items}
  columns={[
    { key: 'nom', header: 'Nom', sortable: true },
    { key: 'prix', header: 'Prix', align: 'right' },
  ]}
  keyExtractor={(item) => item.id}
  title="Liste des produits"
  onSearch={(q) => setSearch(q)}
  onSort={(key, dir) => handleSort(key, dir)}
  compact
/>
```

#### Option C: Hook useOptimizedTable
```tsx
import { useOptimizedTable } from '../hooks/useOptimizedTable';

const table = useOptimizedTable({
  data: produits,
  keyExtractor: (p) => p.id,
  searchFields: ['nom', 'code'],
  initialSort: { key: 'nom', direction: 'asc' },
});

// Utilisation
<div className="table-scrollable">
  <table>
    <thead>...</thead>
    <tbody>
      {table.paginatedData.map(item => ...)}
    </tbody>
  </table>
</div>
```

## 📋 Pages à Optimiser

### Priorité Haute (Utilisées fréquemment)
- [x] Commandes/CommandeList.tsx
- [x] FacturesTable.tsx  
- [ ] Stock/Ruptures.tsx
- [ ] Stock/Inventaire.tsx
- [ ] Clients.tsx
- [ ] HistoriqueVentes.tsx

### Priorité Moyenne
- [ ] Produits/ProductList.tsx
- [ ] Fournisseurs.tsx
- [ ] GestionUtilisateurs.tsx
- [ ] Comptabilite.tsx

### Modaux
- [ ] ExportCommandeModal.tsx (déjà fait)
- [ ] SuggestionCommandeModal.tsx
- [ ] MergeCommandesModal.tsx

## 🔧 Instructions Rapides

### Pour chaque page avec tableau :

1. **Importer le composant** :
```tsx
import { PageWithTable } from '../components/common';
```

2. **Wrapper la page** :
```tsx
// AVANT
<div className="flex flex-col h-full p-4">
  <div className="flex justify-between items-center mb-4">
    <h1 className="text-xl font-bold">Titre</h1>
    <button>Action</button>
  </div>
  <div className="overflow-auto">
    <table>...</table>
  </div>
</div>

// APRÈS
<PageWithTable
  title="Titre"
  actions={<button>Action</button>}
>
  <table className="table table-sm w-full">...</table>
</PageWithTable>
```

3. **Résultat** :
- ✅ Header compact automatique
- ✅ Scrollbar fine (6px)
- ✅ Padding réduit pour écrans 14"
- ✅ Responsive intégré

## 📱 Optimisations Écran 14"

Les styles CSS incluent une media query pour réduire automatiquement l'espace sur les petits écrans :

```css
@media (max-height: 768px) {
  .page-header-compact { @apply py-1.5; }
  .page-header-compact h1 { @apply text-sm; }
  .table-compact th, td { @apply p-1.5; }
}
```

## 🎨 Thème Sombre

Les scrollbars s'adaptent automatiquement au thème sombre :
- **Clair** : Scrollbar grise semi-transparente
- **Sombre** : Scrollbar blanche semi-transparente

## 🚀 Exemple Complet

```tsx
import { PageWithTable } from '../components/common';
import type { Commande } from '../../types';

export default function CommandeList() {
  const commandes: Commande[] = [...];

  return (
    <PageWithTable
      title="Liste des Commandes"
      subtitle={`${commandes.length} commandes`}
      actions={
        <>
          <button className="btn btn-sm">Suggestions</button>
          <button className="btn btn-primary btn-sm">Nouvelle</button>
        </>
      }
      footer={
        <div className="flex justify-between items-center">
          <span>Page 1 sur 5</span>
          <div className="flex gap-2">
            <button className="btn btn-sm">Précédent</button>
            <button className="btn btn-sm">Suivant</button>
          </div>
        </div>
      }
      compact
    >
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>N°</th>
            <th>Fournisseur</th>
            <th>Date</th>
            <th>Montant</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((cmd) => (
            <tr key={cmd.id}>
              <td>{cmd.numero}</td>
              <td>{cmd.fournisseur}</td>
              <td>{cmd.date}</td>
              <td>{cmd.montant}</td>
              <td>{cmd.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageWithTable>
  );
}
```

## 📝 Notes

- Les **scrollbars sont automatiques** - pas besoin de modifier chaque fichier
- Utilisez **PageWithTable** pour une migration rapide
- Utilisez **DataTableOptimized** pour des fonctionnalités avancées (tri, recherche, sélection)
- Les **warnings @apply** dans le CSS sont normaux (linter Tailwind v4)
