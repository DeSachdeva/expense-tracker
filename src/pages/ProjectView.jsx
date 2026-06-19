import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { calculateRawBalances, applySettlements, computeSettlementPlan, formatCurrency } from '../lib/balances'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import SettlementsTab from '../components/SettlementsTab'
import SummaryTab from '../components/SummaryTab'
import SettleUpTab from '../components/SettleUpTab'
import MembersTab from '../components/MembersTab'
import TemplatesTab from '../components/TemplatesTab'
import ActivityTab from '../components/ActivityTab'
import TrashTab from '../components/TrashTab'
import Toast from '../components/Toast'

const BAR_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#6366f1']

export default function ProjectView() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [paymentModes, setPaymentModes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('add')
  const [toast, setToast] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)

  const showToast = (msg, isError = false) => setToast({ msg, isError, key: Date.now() })

  const actorName = user.user_metadata?.full_name || user.email

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [projRes, memRes, catRes, modeRes, expRes, settleRes, tmplRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('project_members').select('*').eq('project_id', projectId).order('joined_at'),
      supabase.from('categories').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('payment_modes').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('expenses').select('*').eq('project_id', projectId).is('deleted_at', null).order('expense_date', { ascending: true, nullsFirst: false }),
      supabase.from('settlement_payments').select('*').eq('project_id', projectId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('expense_templates').select('*').eq('project_id', projectId).order('created_at'),
    ])

    if (projRes.error) { showToast('Could not load project — you may not have access.', true); setLoading(false); return }
    setProject(projRes.data)
    setMembers(memRes.data || [])
    setCategories(catRes.data || [])
    setPaymentModes(modeRes.data || [])
    setExpenses(expRes.data || [])
    setSettlements(settleRes.data || [])
    setTemplates(tmplRes.data || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading project...</div>
  if (!project) return <div style={{ padding: 40, textAlign: 'center' }}>Project not found.</div>

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]))
  const isOwner = project.owner_id === user.id

  return (
    <div>
      <header className="app-header">
        <div className="app-logo" onClick={() => navigate('/')}>← {project.name}</div>
        <div className="user-menu">
          <span>{formatCurrency(expenses.reduce((s, e) => s + Number(e.amount), 0), project.currency)} total</span>
        </div>
      </header>

      <div className="app-container">
        <div className="tabs">
          <button className={`tab ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>➕ <span>Add</span></button>
          <button className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>📋 <span>Expenses</span></button>
          <button className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>💚 <span>Settlements</span></button>
          <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>📊 <span>Summary</span></button>
          <button className={`tab ${activeTab === 'settle' ? 'active' : ''}`} onClick={() => setActiveTab('settle')}>💸 <span>Settle up</span></button>
          <button className={`tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>👥 <span>Members</span></button>
          <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>🔁 <span>Templates</span></button>
          <button className={`tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>🕘 <span>Activity</span></button>
          <button className={`tab ${activeTab === 'trash' ? 'active' : ''}`} onClick={() => setActiveTab('trash')}>🗑 <span>Trash</span></button>
        </div>

        {activeTab === 'add' && (
          <ExpenseForm
            project={project}
            members={members}
            categories={categories}
            paymentModes={paymentModes}
            templates={templates}
            editingExpense={editingExpense}
            clearEditing={() => setEditingExpense(null)}
            user={user}
            onSaved={async (expense, isEdit) => {
              await loadAll()
              await logActivity({
                projectId,
                actorId: user.id,
                actorName,
                action: isEdit ? 'updated' : 'created',
                entityType: 'expense',
                entityId: expense.id,
                summary: `${isEdit ? 'Edited' : 'Added'} expense "${expense.description}" (${formatCurrency(expense.amount, project.currency)})`,
              })
              showToast(isEdit ? 'Expense updated!' : 'Expense added!')
              if (isEdit) setActiveTab('list')
            }}
            onAddCategory={async (name) => {
              const { data, error } = await supabase.from('categories').insert({ project_id: projectId, name }).select().single()
              if (!error) { setCategories((c) => [...c, data]); showToast(`Category "${name}" added.`) }
              return data
            }}
            onAddPaymentMode={async (name) => {
              const { data, error } = await supabase.from('payment_modes').insert({ project_id: projectId, name }).select().single()
              if (!error) { setPaymentModes((m) => [...m, data]); showToast(`Payment mode "${name}" added.`) }
              return data
            }}
          />
        )}

        {activeTab === 'list' && (
          <ExpenseList
            project={project}
            expenses={expenses}
            members={members}
            memberMap={memberMap}
            categories={categories}
            paymentModes={paymentModes}
            onEdit={(exp) => { setEditingExpense(exp); setActiveTab('add') }}
            onDeleted={async (exp) => {
              const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', exp.id)
              if (!error) {
                await loadAll()
                await logActivity({ projectId, actorId: user.id, actorName, action: 'deleted', entityType: 'expense', entityId: exp.id, summary: `Deleted expense "${exp.description}" (${formatCurrency(exp.amount, project.currency)})` })
                showToast('Expense moved to trash.')
              }
            }}
          />
        )}

        {activeTab === 'payments' && (
          <SettlementsTab
            project={project}
            members={members}
            memberMap={memberMap}
            settlements={settlements}
            paymentModes={paymentModes}
            user={user}
            onAdded={async (s) => {
              await loadAll()
              await logActivity({ projectId, actorId: user.id, actorName, action: 'created', entityType: 'settlement', entityId: s.id, summary: `Recorded payment: ${memberMap[s.from_member]?.display_name} → ${memberMap[s.to_member]?.display_name} (${formatCurrency(s.amount, project.currency)})` })
              showToast('Payment recorded!')
            }}
            onDeleted={async (s) => {
              const { error } = await supabase.from('settlement_payments').update({ deleted_at: new Date().toISOString() }).eq('id', s.id)
              if (!error) {
                await loadAll()
                await logActivity({ projectId, actorId: user.id, actorName, action: 'deleted', entityType: 'settlement', entityId: s.id, summary: `Removed payment record: ${memberMap[s.from_member]?.display_name} → ${memberMap[s.to_member]?.display_name}` })
                showToast('Payment record moved to trash.')
              }
            }}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryTab project={project} members={members} expenses={expenses} settlements={settlements} categories={categories} paymentModes={paymentModes} barColors={BAR_COLORS} />
        )}

        {activeTab === 'settle' && (
          <SettleUpTab project={project} members={members} expenses={expenses} settlements={settlements} />
        )}

        {activeTab === 'members' && (
          <MembersTab
            project={project}
            members={members}
            isOwner={isOwner}
            user={user}
            onChanged={loadAll}
            showToast={showToast}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesTab
            project={project}
            templates={templates}
            members={members}
            categories={categories}
            paymentModes={paymentModes}
            onChanged={loadAll}
            onUseTemplate={(tmpl) => { setEditingExpense({ fromTemplate: tmpl }); setActiveTab('add') }}
            showToast={showToast}
          />
        )}

        {activeTab === 'activity' && <ActivityTab projectId={projectId} />}

        {activeTab === 'trash' && (
          <TrashTab
            projectId={projectId}
            project={project}
            memberMap={memberMap}
            onRestored={async (summary) => {
              await loadAll()
              await logActivity({ projectId, actorId: user.id, actorName, action: 'restored', entityType: 'expense', summary })
              showToast('Restored successfully!')
            }}
          />
        )}
      </div>

      {toast && <Toast key={toast.key} message={toast.msg} isError={toast.isError} />}
    </div>
  )
}
