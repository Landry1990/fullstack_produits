import { describe, it, expect, beforeEach } from 'vitest';
import { savePostLoginRedirect, consumePostLoginRedirect } from '../postLoginRedirect';

describe('postLoginRedirect', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    it('sauvegarde et restaure une page /app', () => {
        savePostLoginRedirect('/app/statistiques-fournisseurs');
        expect(consumePostLoginRedirect()).toBe('/app/statistiques-fournisseurs');
    });

    it('conserve les query params', () => {
        savePostLoginRedirect('/app/ventes?date=2026-01-01');
        expect(consumePostLoginRedirect()).toBe('/app/ventes?date=2026-01-01');
    });

    it('retourne null si rien n\'a été sauvegardé', () => {
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it('consomme la clé : une seule restauration possible', () => {
        savePostLoginRedirect('/app/dashboard');
        consumePostLoginRedirect();
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it('ignore les chemins hors /app', () => {
        savePostLoginRedirect('/login');
        savePostLoginRedirect('/');
        savePostLoginRedirect('/licence');
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it('ignore les pages d\'impression', () => {
        savePostLoginRedirect('/app/print-invoice/42');
        savePostLoginRedirect('/app/printing/7');
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it('rejette les URLs absolues stockées manuellement', () => {
        window.localStorage.setItem('post_login_redirect', 'https://evil.example.com');
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it('rejette les chemins //external stockés manuellement', () => {
        window.localStorage.setItem('post_login_redirect', '//evil.example.com');
        expect(consumePostLoginRedirect()).toBeNull();
    });
});
