import { useState } from 'react';

interface Forme {
  id: number;
  nom: string;
  description?: string;
}

export default function Formes() {
  const [formes] = useState<Forme[]>([
    { id: 1, nom: 'Comprimé', description: 'Forme solide pour administration orale' },
    { id: 2, nom: 'Gélule', description: 'Capsule contenant le principe actif' },
    { id: 3, nom: 'Sirop', description: 'Solution liquide sucrée' },
    { id: 4, nom: 'Pommade', description: 'Préparation semi-solide pour usage externe' },
    { id: 5, nom: 'Crème', description: 'Émulsion pour application cutanée' },
    { id: 6, nom: 'Injection', description: 'Solution injectable' },
    { id: 7, nom: 'Suppositoire', description: 'Forme pour administration rectale' },
    { id: 8, nom: 'Gouttes', description: 'Solution en gouttes' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForme, setNewForme] = useState({ nom: '', description: '' });

  const filteredFormes = formes.filter(forme =>
    forme.nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Formes Pharmaceutiques</h1>
          <p className="text-sm text-base-content/80">Gestion des formes galéniques</p>
        </div>
        <button 
          className="btn btn-primary gap-2"
          onClick={() => setShowAddModal(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Nouvelle Forme
        </button>
      </div>

      {/* Stats */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-base-content/70">Total des formes</p>
              <h3 className="text-2xl font-bold text-base-content">{formes.length}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="form-control">
            <label className="label"><span className="label-text">Rechercher une forme</span></label>
            <input
              type="text"
              placeholder="Nom de la forme..."
              className="input input-bordered"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid of Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFormes.map(forme => (
          <div key={forme.id} className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-base-content">{forme.nom}</h3>
                  <p className="text-sm text-base-content/70 mt-1">{forme.description}</p>
                </div>
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-ghost btn-sm btn-circle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-200">
                    <li><a>Modifier</a></li>
                    <li><a className="text-error">Supprimer</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFormes.length === 0 && (
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-8 text-center">
            <p className="text-base-content/50">Aucune forme trouvée</p>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Nouvelle Forme Pharmaceutique</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Nom</span></label>
                <input
                  type="text"
                  placeholder="Ex: Comprimé"
                  className="input input-bordered"
                  value={newForme.nom}
                  onChange={(e) => setNewForme({ ...newForme, nom: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Description</span></label>
                <textarea
                  placeholder="Description de la forme..."
                  className="textarea textarea-bordered"
                  value={newForme.description}
                  onChange={(e) => setNewForme({ ...newForme, description: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Annuler</button>
              <button className="btn btn-primary">Enregistrer</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)}></div>
        </div>
      )}
    </div>
  );
}
