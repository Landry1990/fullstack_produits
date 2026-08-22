import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBreakpoint } from '../useBreakpoint';

/**
 * Helper : simule une largeur d'écran donnée.
 * Met à jour window.innerWidth via un spy et déclenche un événement resize.
 */
let innerWidthSpy: ReturnType<typeof vi.spyOn> | null = null;

function setViewport(width: number) {
  if (!innerWidthSpy) {
    innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get');
  }
  innerWidthSpy.mockReturnValue(width);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

describe('useBreakpoint', () => {
  beforeEach(() => {
    innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    innerWidthSpy = null;
  });

  it('retourne desktop pour un viewport large', () => {
    setViewport(1280);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.width).toBe(1280);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.breakpoint).toBe('xl');
  });

  it('retourne mobile pour un viewport étroit', () => {
    setViewport(390);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.width).toBe(390);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.breakpoint).toBeNull();
  });

  it('retourne tablette pour un viewport moyen', () => {
    setViewport(834);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.width).toBe(834);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.breakpoint).toBe('md');
  });

  it('réagit au redimensionnement de la fenêtre', async () => {
    setViewport(1280);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isDesktop).toBe(true);

    setViewport(480);

    await waitFor(() => expect(result.current.width).toBe(480));
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('identifie correctement chaque breakpoint Tailwind', () => {
    const cases: [number, string | null][] = [
      [320, null],
      [640, 'sm'],
      [768, 'md'],
      [1024, 'lg'],
      [1280, 'xl'],
      [1536, '2xl'],
      [1920, '2xl'],
    ];

    for (const [width, expected] of cases) {
      setViewport(width);
      const { result } = renderHook(() => useBreakpoint());
      expect(result.current.breakpoint).toBe(expected);
    }
  });
});
