import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, Braces, Check, CircleHelp, Database, LoaderCircle, Play, Sparkles, Table2, TriangleAlert } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const starter = 'Show employees earning more than 50000.';

export default function App() {
  const [question, setQuestion] = useState(starter);
  const [sql, setSql] = useState('');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('checking');
  useEffect(() => { fetch(`${API}/health`).then((r) => r.json()).then((v) => setStatus(v.status === 'ok' ? 'online' : 'offline')).catch(() => setStatus('offline')); }, []);

  async function request(path, body) {
    const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  async function generate() {
    setError(''); setRows([]); setColumns([]); setSql(''); setLoading('generate');
    try { const result = await request('/queries/generate', { question }); setSql(result.sql); }
    catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }
  async function execute() {
    setError(''); setRows([]); setColumns([]); setLoading('execute');
    try { const result = await request('/queries/execute', { sql }); setRows(result.rows); setColumns(result.columns); if (result.truncated) setError('Showing the first 100 matching records.'); }
    catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Braces size={19}/></span>QueryBridge</a><div className="top-right"><span className="tiny-label">SQL WORKSPACE</span><span className={`health ${status}`}><i/>{status === 'online' ? 'API connected' : status === 'checking' ? 'Connecting…' : 'API offline'}</span></div></header>
    <section className="hero" id="top"><div className="eyebrow"><Sparkles size={13}/> YOUR DATA, YOUR QUESTIONS</div><h1>Ask in plain English.<br/><span>Get answers in SQL.</span></h1><p>Turn everyday questions into clear SQL, then run them against your employee dataset.</p></section>
    <section className="workspace">
      <div className="section-head"><div className="step"><span>01</span><div><h2>Ask a question</h2><p>Describe what you want to find in your data.</p></div></div><span className="powered"><span/> Natural language</span></div>
      <label className="input-label" htmlFor="question">YOUR QUESTION</label><div className="question-box"><CircleHelp size={17}/><input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generate()} placeholder="e.g. Show employees in IT earning over 70,000"/><button onClick={generate} disabled={!!loading || !question.trim()}>{loading === 'generate' ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}Generate SQL<ArrowRight size={15}/></button></div>
      <div className="examples"><span>TRY AN EXAMPLE</span>{['Show all employees', 'Employees in IT', 'Top 5 highest-paid'].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>
      <div className="flow-divider"><span><ArrowDown size={15}/></span></div>
      <div className="section-head sql-head"><div className="step"><span>02</span><div><h2>Review generated SQL</h2><p>Check the query before running it.</p></div></div><span className="sql-tag"><i/> MYSQL</span></div>
      <div className={`code-panel ${sql ? '' : 'empty'}`}><div className="code-top"><span><i/> query.sql</span><span>READ ONLY</span></div><pre>{sql ? <><em>SELECT</em>{sql.slice(6)}</> : <span className="placeholder">Your SQL will appear here after you generate it.</span>}</pre></div>
      <div className="sql-actions"><span><Database size={14}/> Runs against the querybridge MySQL database</span><button className="execute" onClick={execute} disabled={!sql || !!loading}>{loading === 'execute' ? <LoaderCircle className="spin" size={16}/> : <Play size={15} fill="currentColor"/>}Execute query</button></div>
      {error && <div className="message"><TriangleAlert size={16}/><span>{error}</span></div>}
      <div className="results"><div className="results-head"><div className="step"><span>03</span><div><h2>Results</h2><p>{rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'} returned` : 'Your query results will show up here.'}</p></div></div>{rows.length > 0 && <span className="row-count"><Check size={13}/> {rows.length} rows</span>}</div>
        {rows.length > 0 ? <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c}>{c.replace('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id ?? i}>{columns.map((c) => <td key={c}>{c === 'salary' ? `$${Number(row[c]).toLocaleString()}` : row[c]}</td>)}</tr>)}</tbody></table></div> : <div className="empty-results"><span><Table2 size={21}/></span><b>Nothing to show yet</b><small>Generate a query, then execute it to see your data.</small></div>}
      </div>
    </section>
    <footer><span><Database size={14}/> MySQL · querybridge.employees</span><span>Built for learning SQL, one question at a time.</span></footer>
  </main>;
}
