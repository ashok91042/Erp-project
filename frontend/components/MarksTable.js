// Presentational marks table. `rows` are real API mark records
// ({ roll_no, full_name, subject, exam_name, score, max_score }).
const gradeOf = (pct) => (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D');

export default function MarksTable({ rows = [], empty = 'No marks recorded yet.' }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th>
            <th className="px-4 py-3">Student</th><th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Exam</th><th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = r.max_score ? (Number(r.score) / Number(r.max_score)) * 100 : 0;
            return (
              <tr key={r.id || `${r.student_id}-${r.subject}-${r.exam_name}`} className="border-t border-slate-100">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{r.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{r.full_name}</td>
                <td className="px-4 py-3">{r.subject}</td>
                <td className="px-4 py-3 text-slate-500">{r.exam_name}</td>
                <td className="px-4 py-3">{r.score} / {r.max_score}</td>
                <td className="px-4 py-3 font-black text-red-600">{gradeOf(pct)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

