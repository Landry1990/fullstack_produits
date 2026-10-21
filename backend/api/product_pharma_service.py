"""Service d'accès aux données médicamenteuses MQ pour un produit.

Source : dci/export/ (CSV générés depuis les tables MyISAM MQ).
"""
import csv
import os
import re
from functools import lru_cache

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q

from .models import DrugInteraction, Produit


def _norm(text):
    if not text:
        return ''
    return re.sub(r'\s+', ' ', text).strip()


def _extract_cip7(code):
    """Extrait le CIP7 d'un code produit.

    - CIP7 direct : ``3219294``
    - CIP13 : ``3400932192946`` → ``34009`` + CIP7(7) + clé
    """
    if not code:
        return None
    digits = re.sub(r'\D', '', str(code))
    if len(digits) == 13 and digits.startswith('34009'):
        return digits[5:12]
    if len(digits) == 7:
        return digits
    return None


def _product_cip7s(produit):
    """Tous les CIP7 candidats d'un produit (cip1 + cip2/CIP13)."""
    cips = []
    for raw in (produit.cip1, produit.cip2):
        c = _extract_cip7(raw)
        if c and c not in cips:
            cips.append(c)
    return cips


@lru_cache(maxsize=1)
def _load_mq_data():
    """Charge une seule fois les CSV MQ et construit les index."""
    base = settings.BASE_DIR / 'dci' / 'export'
    if not os.path.isdir(base):
        return {}

    # MQ_FORM : id -> nom (tronqué au CIP7 pour éliminer les métadonnées binaires)
    form_by_id = {}
    try:
        with open(base / 'mq_form.csv', 'r', encoding='utf-8') as f:
            for r in csv.DictReader(f, delimiter=';'):
                pid = (r.get('id') or '').strip()
                if pid:
                    raw = r.get('nom', '')
                    if pid in raw:
                        raw = raw.split(pid, 1)[0]
                    # Le nom s'arrête au padding fixe (3+ espaces) : le reste
                    # du champ contient des métadonnées binaires (ATC, pointeurs)
                    raw = re.split(r'\s{3,}', raw)[0]
                    form_by_id[pid] = _norm(raw)
    except FileNotFoundError:
        pass

    # MQ_MONOG : code -> row + index par DCI (partie après le nom court)
    monog_by_code = {}
    monog_by_dci = {}
    try:
        with open(base / 'mq_monog.csv', 'r', encoding='utf-8') as f:
            for r in csv.DictReader(f, delimiter=';'):
                code = (r.get('code') or '').strip()
                if code:
                    monog_by_code[code] = r
                # Format : "NOM COURT   DCI"
                full = (r.get('nom') or '')
                parts = [p.strip() for p in full.split('  ') if p.strip()]
                if len(parts) >= 2:
                    dci = parts[-1].upper()
                    monog_by_dci.setdefault(dci, []).append(r)
    except FileNotFoundError:
        pass

    # MQ_MEMO : liste ordonnée (index = record #) + dict par id
    memo_records = []
    memo_by_id = {}
    try:
        with open(base / 'mq_memo.csv', 'r', encoding='utf-8') as f:
            for r in csv.DictReader(f, delimiter=';'):
                text = _norm(r.get('texte', ''))
                memo_records.append(text)
                mid = (r.get('id') or '').strip()
                if mid:
                    try:
                        memo_by_id[int(mid)] = text
                    except ValueError:
                        pass
    except FileNotFoundError:
        pass

    # MQ_CLASS : class_id (CIP7) -> (atc_a, atc_b)
    class_by_cip = {}
    try:
        with open(base / 'mq_class.csv', 'r', encoding='utf-8') as f:
            for r in csv.DictReader(f, delimiter=';'):
                cip = (r.get('class_id') or '').strip()
                if cip:
                    class_by_cip[cip] = (r.get('code_a', '').strip(), r.get('code_b', '').strip())
    except FileNotFoundError:
        pass

    # MQ_FORM tail pointers -> textes mémo (posologie/CI additionnels)
    form_tail_memos = {}
    try:
        with open(base / 'mq_form_tail_memos.csv', 'r', encoding='utf-8') as f:
            for r in csv.DictReader(f, delimiter=';'):
                fid = (r.get('form_id') or '').strip()
                text = _norm(r.get('memo_text', ''))
                if fid and text:
                    form_tail_memos.setdefault(fid, []).append(text)
    except FileNotFoundError:
        pass

    return {
        'form_by_id': form_by_id,
        'form_tail_memos': form_tail_memos,
        'monog_by_code': monog_by_code,
        'monog_by_dci': monog_by_dci,
        'memo_records': memo_records,
        'memo_by_id': memo_by_id,
        'class_by_cip': class_by_cip,
    }


def _extract_memo_texts(monog_row, memo_records, memo_by_id):
    """Pour un MONOG, récupère les textes Mémo pointés par les pointeurs."""
    if not monog_row:
        return []
    texts = []
    seen = set()
    for i in range(1, 10):
        ptr = (monog_row.get(f'ptr{i}') or '').strip()
        if not ptr:
            continue
        try:
            ptr_val = int(ptr)
        except ValueError:
            continue
        if ptr_val <= 0:
            continue
        # Pointeur mémo par id (~1e9)
        if ptr_val in memo_by_id:
            text = memo_by_id[ptr_val]
            if text and text not in seen:
                texts.append(text)
                seen.add(text)
            continue
        # Pointeur byte offset dans MQ_MEMO.MYD : record length = 255
        if memo_records:
            record_n = ptr_val // 255
            if 0 <= record_n < len(memo_records):
                text = memo_records[record_n]
                if text and text not in seen:
                    texts.append(text)
                    seen.add(text)
    return texts


def _parse_posology_blocks(text):
    """Découpe un texte MQ_MEMO en blocs posologie (Voie/Terrain/Indication)."""
    if not text:
        return []
    # Les blocs sont séparés par des doubles sauts de ligne
    raw_blocks = [b.strip() for b in text.split('\r\n\r\n') if b.strip()]
    blocks = []
    for raw in raw_blocks:
        if 'Voie(s):' in raw or 'Terrain(s):' in raw or 'Indication(s):' in raw or 'Posologie' in raw:
            block = {'raw': raw, 'fields': {}}
            current_key = None
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                m = re.match(
                    r'^(Voie\(s\)|Terrain\(s\)|Indication\(s\)|Posologie USUELLE|Dose minimale|Dose maximale|Fréquence minimale|Fréquence maximale|Durée de traitement)\s*:\s*(.*)$',
                    line
                )
                if m:
                    current_key = m.group(1)
                    block['fields'][current_key] = m.group(2).strip()
                elif current_key:
                    block['fields'][current_key] += ' ' + line
            blocks.append(block)
    return blocks


def _active_principles(form_name):
    """Extrait les principes actifs entre parenthèses du nom MQ_FORM."""
    if not form_name:
        return []
    found = []
    for match in re.findall(r'\(([^()]+)\)', form_name):
        for part in match.split(','):
            part = part.strip()
            if part and len(part) > 2:
                found.append(part)
    return found


# Cache process code CIP → nom produit local : les mêmes stubs MQ-…
# reviennent dans chaque alerte/produit (check_interactions boucle par paire)
# — sans dédup c'est un N+1 par requête en caisse.
_local_name_cache: dict[str, str | None] = {}
_LOCAL_NAME_CACHE_MAX = 8192


def _local_product_name(code):
    """Nom du produit local correspondant à un code CIP (None si introuvable)."""
    if code in _local_name_cache:
        return _local_name_cache[code]
    try:
        local = Produit.objects.filter(
            Q(cip1=code) | Q(cip2=code) | Q(cip2__icontains=code)
        ).values_list('name', flat=True).first()
        if not local:
            cip7 = _extract_cip7(code)
            if cip7 and cip7 != code:
                local = Produit.objects.filter(
                    cip1=cip7
                ).values_list('name', flat=True).first()
    except Exception:
        local = None
    if len(_local_name_cache) < _LOCAL_NAME_CACHE_MAX:
        _local_name_cache[code] = local
    return local


def _prewarm_local_names(codes):
    """Résout les correspondances exactes cip1/cip2 en une seule requête.

    Les codes restants (icontains / CIP7 dérivé) seront résolus et cachés
    individuellement par _local_product_name.
    """
    todo = {c for c in codes if c and c not in _local_name_cache}
    if not todo:
        return
    rows = Produit.objects.filter(
        Q(cip1__in=todo) | Q(cip2__in=todo)
    ).values_list('cip1', 'cip2', 'name')
    for cip1, cip2, name in rows:
        if cip1 in todo and cip1 not in _local_name_cache:
            _local_name_cache[cip1] = name
        if cip2 in todo and cip2 not in _local_name_cache:
            _local_name_cache[cip2] = name


def _resolve_other_name(name, form_by_id):
    """Remplace MQ-<CIP7> par un nom lisible si possible."""
    if not name or not name.startswith('MQ-'):
        return name
    code = name[3:].strip()
    if not code or len(code) > 20:
        # Codes "MQ-4282965863" sont des identifiants internes, pas des CIP
        return name
    # Nom dans MQ_FORM (CIP7 direct ou extrait d'un CIP13)
    cip7 = _extract_cip7(code) or code
    form_name = form_by_id.get(cip7)
    if form_name:
        return form_name
    # Produit local (cip1 CIP7/CIP13 ou cip2) — résolution cachée/batchée
    local = _local_product_name(code)
    return local or name


def _interactions_for_product(produit, data, cip7s=None):
    """Interactions des CIP-stubs du produit et des substances liées."""
    form_by_id = data.get('form_by_id', {})
    cip7s = cip7s or _product_cip7s(produit)
    cip_stubs = [f'MQ-{c}' for c in cip7s]
    substance_ids = list(produit.substances.values_list('id', flat=True))
    qs = DrugInteraction.objects.filter(
        Q(substance_a__nom__in=cip_stubs) |
        Q(substance_b__nom__in=cip_stubs) |
        Q(substance_a_id__in=substance_ids) |
        Q(substance_b_id__in=substance_ids)
    ).select_related('substance_a', 'substance_b').distinct()
    interactions = list(qs[:100])
    _prewarm_local_names(
        s.nom[3:].strip()
        for inter in interactions
        for s in (inter.substance_a, inter.substance_b)
        if s.nom and s.nom.startswith('MQ-')
    )
    alerts = []
    for inter in interactions:
        a_in = (
            inter.substance_a_id in substance_ids
            or inter.substance_a.nom in cip_stubs
        )
        other = inter.substance_b if a_in else inter.substance_a
        other_name = _resolve_other_name(other.nom, form_by_id)
        alerts.append({
            'substance_a': _resolve_other_name(inter.substance_a.nom, form_by_id),
            'substance_b': _resolve_other_name(inter.substance_b.nom, form_by_id),
            'other': other_name,
            'gravity': inter.gravity,
            'description': inter.description,
        })
    return alerts


def _generiques_for_product(produit):
    """Produits substituables (même substance / DCI), excluant le produit lui-même."""
    substances = list(produit.substances.all())
    if not substances and produit.dci_reference:
        substances = [produit.dci_reference]
    if not substances:
        return []
    substance_ids = [s.id for s in substances]
    qs = Produit.objects.filter(
        Q(substances__id__in=substance_ids) | Q(dci_reference_id__in=substance_ids),
        is_active=True,
        stock__gt=0
    ).exclude(pk=produit.pk).distinct().order_by('selling_price')[:20]
    return [
        {'id': p.id, 'name': p.name, 'selling_price': str(p.selling_price), 'stock': p.stock}
        for p in qs
    ]


def invalidate_pharma_cache(*produit_ids):
    """Invalide le cache du panneau pharmaco après modification des liens DCI."""
    keys = [f'pharma_data:{pid}' for pid in produit_ids if pid]
    if keys:
        cache.delete_many(keys)


def get_product_pharma_data(produit):
    """Retourne le dictionnaire complet pour le panneau pharmaco."""
    cache_key = f'pharma_data:{produit.id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    data = _load_mq_data()
    if not data:
        return None

    cip7s = _product_cip7s(produit)
    # Meilleur CIP7 : celui qui matche MQ_FORM, sinon monog/class, sinon le premier
    cip = ''
    for c in cip7s:
        if c in data['form_by_id']:
            cip = c
            break
    if not cip:
        for c in cip7s:
            if c in data['monog_by_code'] or c in data['class_by_cip']:
                cip = c
                break
    if not cip and cip7s:
        cip = cip7s[0]

    form_name = data['form_by_id'].get(cip, '')
    monog_row = data['monog_by_code'].get(cip)
    atc_tuple = data['class_by_cip'].get(cip, (None, None))

    monog_name = _norm(monog_row.get('nom', '')) if monog_row else ''
    active_principles = _active_principles(form_name or monog_name)

    memo_texts = _extract_memo_texts(monog_row, data['memo_records'], data['memo_by_id'])
    # Textes additionnels depuis le tail binaire de MQ_FORM (souvent posologie max)
    memo_texts.extend(data.get('form_tail_memos', {}).get(cip, [])[:20])
    # Déduplication
    seen_texts = set()
    deduped = []
    for txt in memo_texts:
        if txt not in seen_texts:
            seen_texts.add(txt)
            deduped.append(txt)
    memo_texts = deduped
    # Ajouter les textes de la monographie molécule (DCI) pour posologie / CI
    for principle in active_principles:
        dci = principle.upper()
        for mol_row in data['monog_by_dci'].get(dci, []):
            memo_texts.extend(_extract_memo_texts(mol_row, data['memo_records'], data['memo_by_id']))

    posology_blocks = []
    conservation_texts = []
    indication_items = []
    for text in memo_texts:
        blocks = _parse_posology_blocks(text)
        if blocks:
            posology_blocks.extend(blocks)
        elif 'conservation' in text.lower() or 'durée de conservation' in text.lower():
            conservation_texts.append(text)
        elif 'indication' in text.lower() or text.startswith('-'):
            # Liste d'indications type "-ENDOMETRIOSE  -MENOMETRORRAGIE"
            # ou "-AMENORRHEE SECONDAIRE -CYCLE ARTIFICIEL ..."
            text = re.sub(r'\s+', ' ', text)
            # Sépare sur les tirets précédés d'un espace ou en début de chaîne
            parts = re.split(r'(?:^|\s)-\s*', text)
            for part in parts:
                part = re.sub(r'^-\s*', '', part).strip()
                if not part or 'indication' in part.lower():
                    continue
                # Nettoie le label "Indication(s):" en début
                part = re.sub(r'^Indication\(s\)\s*:\s*', '', part, flags=re.IGNORECASE)
                if part:
                    indication_items.append(part)

    seen = set()
    dedup = []
    for i in indication_items:
        key = i.upper()
        if key not in seen:
            seen.add(key)
            dedup.append(i)
    indication_items = dedup

    response = {
        'product': {
            'id': produit.id,
            'name': produit.name,
            'cip1': produit.cip1,
            'code_atc': produit.code_atc or atc_tuple[1] or atc_tuple[0] or '',
        },
        'mq_form': {
            'id': cip,
            'name': form_name,
        },
        'monog': {
            'code': cip,
            'name': monog_name,
        },
        'active_principles': active_principles,
        'posology_blocks': posology_blocks,
        'conservation_texts': conservation_texts,
        'indication_items': indication_items,
        'interactions': _interactions_for_product(produit, data, cip7s),
        'therapeutic_classes': [
            {'code': atc_tuple[0], 'label': 'Classe ATC'},
            {'code': atc_tuple[1], 'label': 'Sous-classe ATC'},
        ] if atc_tuple[0] else [],
        'generiques': _generiques_for_product(produit),
    }
    cache.set(cache_key, response, timeout=300)
    return response
