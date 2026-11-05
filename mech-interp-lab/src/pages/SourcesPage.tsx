import { Link } from 'react-router-dom'
import { LICENCE_SUMMARY, REFERENCES } from '../content/sources'
import { SECTION_MAP } from '../content/curriculum'
import { Callout, Panel, Stat } from '@llm-materials/course-ui'

export function SourcesPage() {
  return (
    <div className="page">
      <h1 className="page-title">Sources and licensing</h1>
      <p className="page-lede">
        Every work this course draws on, with the licence it was checked under. Nothing from any of them is
        redistributed: the papers are cited and linked, and every figure in the course is an original plot of a
        computation made in your browser.
      </p>

      <div className="stat-row">
        <Stat label="Works cited" value={String(REFERENCES.length)} />
        <Stat label="Primary source" value="arXiv:2309.08600" />
        <Stat label="Figures reproduced" value="0" />
        <Stat label="Datasets redistributed" value="0" />
      </div>

      <Panel title="The references">
        <ul className="reference-list">
          {REFERENCES.map((reference) => (
            <li key={reference.id} className="reference-entry">
              <p className="reference-title">
                <a href={reference.url} rel="noreferrer">
                  {reference.title}
                </a>
              </p>
              <p className="reference-authors">
                {reference.authors} · {reference.year} · {reference.venue}
              </p>
              <p className="reference-used">
                <strong>Used for:</strong> {reference.usedFor}
              </p>
              <p className="reference-licence">
                <strong>Licence:</strong> {reference.licenseNote}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What this course does not do" accent="amber">
        <ul className="bullet-list">
          <li>
            <strong>{LICENCE_SUMMARY.source}</strong>
          </li>
          <li>
            <strong>{LICENCE_SUMMARY.figures}</strong>
          </li>
          <li>
            <strong>{LICENCE_SUMMARY.code}</strong>
          </li>
          <li>
            <strong>{LICENCE_SUMMARY.data}</strong>
          </li>
          <li>
            <strong>{LICENCE_SUMMARY.models}</strong>
          </li>
        </ul>
      </Panel>

      <Panel title="The section maps of the sources" accent="teal">
        <p className="body-text">
          The lesson pages cite their sources by section. The prefix says which source: <code>sae:</code> is
          Cunningham et al., <code>circuits:</code> is Conmy et al., and <code>framework:</code> is Elhage et al. The
          test suite refuses any lesson that names a section which is not in this list.
        </p>
        <table className="def-table">
          <caption className="sr-only">The sections of the sources used by this course</caption>
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">Title</th>
              <th scope="col">What the course takes from it</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(SECTION_MAP).map(([section, entry]) => (
              <tr key={section}>
                <th scope="row" className="def-term">
                  §{section}
                </th>
                <td>{entry.title}</td>
                <td className="def-note">{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Callout tone="note" title="A note on versions">
        An arXiv licence is attached to a specific submission, and it can change between versions. This course was
        written against arXiv:2309.08600. If you reuse anything from it, check the version you are citing and check
        that version’s licence.
      </Callout>

      <p className="muted">
        The catalogue of every source in this collection, across all the courses, lives in the workspace at{' '}
        <code>references/manifest.json</code>, and is validated by a script that re-reads every arXiv title live.
      </p>

      <p className="muted">
        <Link to="/">Back to the overview</Link>
      </p>
    </div>
  )
}
