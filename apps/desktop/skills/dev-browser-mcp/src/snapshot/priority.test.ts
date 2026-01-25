import { describe, it, expect } from 'vitest';
import { getElementPriority, ROLE_PRIORITIES } from './priority';

describe('priority scoring', () => {
  describe('getElementPriority', () => {
    it('should score buttons highest', () => {
      const score = getElementPriority('button', true);
      expect(score).toBe(150); // 100 base + 50 viewport bonus
    });

    it('should score textbox high', () => {
      const score = getElementPriority('textbox', true);
      expect(score).toBe(145); // 95 base + 50 viewport bonus
    });

    it('should give viewport bonus', () => {
      const inViewport = getElementPriority('link', true);
      const outViewport = getElementPriority('link', false);
      expect(inViewport - outViewport).toBe(50);
    });

    it('should default unknown roles to 50', () => {
      const score = getElementPriority('unknown-role', false);
      expect(score).toBe(50);
    });

    it('should score navigation lower than primary inputs', () => {
      const navigation = getElementPriority('navigation', false);
      const button = getElementPriority('button', false);
      expect(button).toBeGreaterThan(navigation);
    });
  });

  describe('ROLE_PRIORITIES', () => {
    it('should define priorities for all interactive roles', () => {
      const interactiveRoles = [
        'button', 'link', 'textbox', 'checkbox', 'radio',
        'combobox', 'listbox', 'option', 'tab', 'menuitem',
      ];
      for (const role of interactiveRoles) {
        expect(ROLE_PRIORITIES[role]).toBeDefined();
        expect(ROLE_PRIORITIES[role]).toBeGreaterThan(0);
      }
    });
  });
});
