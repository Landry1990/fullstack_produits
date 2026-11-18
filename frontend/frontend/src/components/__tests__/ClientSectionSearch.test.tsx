import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { AyantDroit, Client } from '../../types'
import ClientSection from '../facturation/ClientSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('../../utils/storage', () => ({
  safeStorage: { getItem: () => null, setItem: () => {} },
}))

vi.mock('../facturation/AyantDroitSection', () => ({ default: () => null }))
vi.mock('../facturation/ClientInfoBadges', () => ({ default: () => null }))
vi.mock('../ui/EmptyState', () => ({ EmptyState: () => <div>empty</div> }))
vi.mock('../shadcn/button', () => ({ Button: (p: ComponentProps<'button'>) => <button {...p} /> }))

const clients: Client[] = [
  {
    id: 2040, name: 'AXA ASSURANCES', phone: '+23789568478', email: '',
    address: 'YAOUNDE/NLONGKACK', client_type: 'PROFESSIONNEL',
  },
]

const ayants: AyantDroit[] = [
  { id: 10, client_name: 'AXA ASSURANCES', matricule: 'J78455', nom: 'FOTSO RAOUL', societe: 'OK FOODS SA', client: 2040 },
  { id: 11, client_name: 'AXA ASSURANCES', matricule: '7889', nom: 'NDEMA SYSTEM', client: 2040 },
]

describe('ClientSection search dropdown', () => {
  it('renders client and ayant droit rows for query "axa"', () => {
    const { container } = render(
      <ClientSection
        clients={clients}
        filteredClients={clients}
        useManualClient={false}
        setUseManualClient={vi.fn()}
        manualClientName=""
        setManualClientName={vi.fn()}
        selectedClient={null}
        setSelectedClient={vi.fn()}
        clientSearch="axa"
        setClientSearch={vi.fn()}
        showClientDropdown={true}
        setShowClientDropdown={vi.fn()}
        ayantDroitSearchResults={ayants}
        ayantDroitSearchLoading={false}
        onOpenCreateClient={vi.fn()}
        ayantsDroitList={[]}
        selectedAyantDroit={null}
        setSelectedAyantDroit={vi.fn()}
        showNewAyantDroit={false}
        setShowNewAyantDroit={vi.fn()}
        ayantDroitNom=""
        setAyantDroitNom={vi.fn()}
        ayantDroitMatricule=""
        setAyantDroitMatricule={vi.fn()}
        ayantDroitSociete=""
        setAyantDroitSociete={vi.fn()}
      />
    )
    const listbox = container.querySelector('#facturation-client-listbox')
    expect(listbox?.textContent).toContain('AXA ASSURANCES')
  })
})
