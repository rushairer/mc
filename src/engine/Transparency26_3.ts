export type ImprovedTransparencyBackend26_3 = 'sorted-alpha' | 'oit-pending';

export interface ImprovedTransparencySnapshot26_3 {
  enabled: boolean;
  backend: ImprovedTransparencyBackend26_3;
  /** False until the renderer owns a real order-independent accumulation/revealage pass. */
  fullOit: false;
}

/**
 * Java 26.3 exposes Improved Transparency as a toggle. Three.js r158 in this
 * project has no drop-in OIT pass, so this state object deliberately reports
 * oit-pending rather than pretending that disabling object sorting is OIT.
 */
export class ImprovedTransparencyState26_3 {
  private enabled = false;

  set(enabled: boolean): ImprovedTransparencySnapshot26_3 {
    this.enabled = !!enabled;
    return this.snapshot();
  }

  toggle(): ImprovedTransparencySnapshot26_3 {
    this.enabled = !this.enabled;
    return this.snapshot();
  }

  snapshot(): ImprovedTransparencySnapshot26_3 {
    return {
      enabled: this.enabled,
      backend: this.enabled ? 'oit-pending' : 'sorted-alpha',
      fullOit: false,
    };
  }
}
