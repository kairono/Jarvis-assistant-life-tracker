import { useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { incomeExpenseByMonth, spendingByCategory } from '../lib/analytics';
import { isThisMonth, money, shortDate } from '../lib/format';
import { SpendingPie } from '../components/charts/SpendingPie';
import { IncomeExpenseLine } from '../components/charts/IncomeExpenseLine';
import { Button, Field, IconButton, Input, Modal, Panel, Select, SectionHeader, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Transaction, TransactionType } from '../types';

const CATEGORIES = ['Salary', 'Freelance', 'Food', 'Rent', 'Transport', 'Entertainment', 'Shopping', 'Health', 'Utilities', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

type Draft = Omit<Transaction, 'id'> & { id?: string };
const blank = (): Draft => ({ date: today(), amount: 0, type: 'expense', category: 'Food', note: '' });

export function Finances() {
  const txns = useCollection('transactions', (a, b) => b.date.localeCompare(a.date));
  const [draft, setDraft] = useState<Draft | null>(null);

  const month = txns.filter((t) => isThisMonth(t.date));
  const income = month.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = month.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  async function save() {
    if (!draft || draft.amount <= 0) return;
    if (draft.id) await db.transactions.put(draft as Transaction);
    else await db.transactions.add(draft);
    setDraft(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Balance · all time" value={money(balance)} tone={balance >= 0 ? 'success' : 'danger'} icon="wallet" />
        <StatCard label="Income · month" value={money(income)} tone="success" />
        <StatCard label="Expense · month" value={money(expense)} tone="danger" />
        <StatCard label="Net · month" value={money(income - expense)} tone={income - expense >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader title="Spending by category" subtitle="This month" />
          <SpendingPie data={spendingByCategory(month)} />
        </Panel>
        <Panel className="p-5">
          <SectionHeader title="Income vs expense" subtitle="Last 6 months" />
          <IncomeExpenseLine data={incomeExpenseByMonth(txns, 6)} />
        </Panel>
      </div>

      <Panel className="p-5">
        <SectionHeader
          title="Transactions"
          subtitle={`${txns.length} records`}
          action={
            <Button onClick={() => setDraft(blank())}>
              <Icon name="plus" size={16} /> Add
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="label-tech border-b border-border/60 text-left">
                <th className="py-2 font-normal">Date</th>
                <th className="py-2 font-normal">Category</th>
                <th className="py-2 font-normal">Note</th>
                <th className="py-2 text-right font-normal">Amount</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="group border-b border-border/40 hover:bg-panel/40">
                  <td className="py-2.5 text-muted">{shortDate(t.date)}</td>
                  <td className="py-2.5 text-text">{t.category}</td>
                  <td className="py-2.5 text-muted">{t.note || '—'}</td>
                  <td className={`py-2.5 text-right font-mono ${t.type === 'income' ? 'text-success' : 'text-text'}`}>
                    {t.type === 'income' ? '+' : '−'}{money(t.amount)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <IconButton icon="pencil" size={14} onClick={() => setDraft(t)} aria-label="Edit" />
                      <IconButton icon="trash" size={14} onClick={() => db.transactions.remove(t.id)} aria-label="Delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit transaction' : 'New transaction'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TransactionType })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </Select>
              </Field>
              <Field label="Amount">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.amount || ''}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {[...new Set([draft.category, ...CATEGORIES])].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Note">
              <Input value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Optional" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
