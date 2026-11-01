import test from 'node:test';
import assert from 'node:assert/strict';
import { trapTab } from '../src/utils/modalFocus.js';

function fixture(start = 'container') {
  const doc = { activeElement: null };
  const control = (name, visible = true) => ({
    name, offsetWidth: visible ? 44 : 0, offsetHeight: visible ? 44 : 0,
    getClientRects: () => [], focus() { doc.activeElement = this; }
  });
  const first = control('first'), middle = control('middle'), last = control('last');
  const hidden = control('hidden', false), container = control('container');
  const modal = { ...control('modal'), querySelectorAll: () => [first, middle, hidden, last], contains: (el) => [first, middle, last, container].includes(el) };
  doc.querySelectorAll = () => [modal];
  const els = { first, middle, last, container, outside: control('outside') };
  doc.activeElement = els[start];
  const tab = (shiftKey = false) => {
    let prevented = false;
    trapTab({ key: 'Tab', shiftKey, defaultPrevented: false, preventDefault() { prevented = true; } }, doc);
    return { prevented, focused: doc.activeElement.name };
  };
  return { tab, doc, modal };
}

test('initial inner container: reverse Tab enters the final action, not the background', () => {
  assert.deepEqual(fixture().tab(true), { prevented: true, focused: 'last' });
});
test('initial inner container: forward Tab enters the first action', () => {
  assert.deepEqual(fixture().tab(), { prevented: true, focused: 'first' });
});
test('last action wraps forward to the first action', () => {
  assert.deepEqual(fixture('last').tab(), { prevented: true, focused: 'first' });
});
test('first action wraps backwards to the last action', () => {
  assert.deepEqual(fixture('first').tab(true), { prevented: true, focused: 'last' });
});
test('normal movement between actions retains browser handling', () => {
  assert.deepEqual(fixture('middle').tab(), { prevented: false, focused: 'middle' });
  assert.deepEqual(fixture('middle').tab(true), { prevented: false, focused: 'middle' });
});
test('focus outside an open modal is recovered in either direction', () => {
  assert.deepEqual(fixture('outside').tab(), { prevented: true, focused: 'first' });
  assert.deepEqual(fixture('outside').tab(true), { prevented: true, focused: 'last' });
});
test('without an open modal normal Tab is untouched', () => {
  const f = fixture('outside'); f.doc.querySelectorAll = () => [];
  assert.deepEqual(f.tab(), { prevented: false, focused: 'outside' });
});
test('non-Tab and already handled events are untouched', () => {
  const f = fixture();
  for (const event of [{ key: 'Escape' }, { key: 'Tab', defaultPrevented: true }]) {
    trapTab({ ...event, preventDefault() { assert.fail('Event should not be intercepted'); } }, f.doc);
    assert.equal(f.doc.activeElement.name, 'container');
  }
});


test('hidden, inert, disabled and negative-tabindex controls are excluded from the cycle', () => {
  const f = fixture('last'); const original = f.modal.querySelectorAll();
  const hidden = { ...original[0], ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility: 'hidden' }) } } };
  const inert = { ...original[0], closest: () => ({}) };
  const disabled = { ...original[0], matches: () => true };
  f.modal.querySelectorAll = () => [hidden, inert, disabled, ...original];
  assert.deepEqual(f.tab(), { prevented: true, focused: 'first' });
});
test('a hidden later dialog does not capture focus from the visible modal', () => {
  const f = fixture('last'); const hidden = { offsetWidth: 0, offsetHeight: 0, getClientRects: () => [] };
  f.doc.querySelectorAll = () => [f.modal, hidden];
  assert.deepEqual(f.tab(), { prevented: true, focused: 'first' });
});
test('a dialog with no actions gets a programmatically focusable fallback', () => {
  const f = fixture(); let tabindex;
  f.modal.querySelectorAll = () => []; f.modal.setAttribute = (key, value) => { if (key === 'tabindex') tabindex = value; };
  assert.deepEqual(f.tab(), { prevented: true, focused: 'modal' }); assert.equal(tabindex, '-1');
});
