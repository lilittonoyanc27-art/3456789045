import './styles.css';
import { NAV_TABS, EXAM_1, EXAM_2, THEORY, RESUMEN_GUIDE, BIG_EXAM, MINI_EXAM } from './data.js';

// ============================================================================
// APPLICATION STATE (persisted in localStorage)
// ============================================================================
const STORAGE_KEY = 'lengua_1eso_hy_es_v1';

const defaultState = {
  activeTab: 'exam1',
  storyMode: 'paragraph', // 'paragraph' (by paragraph) | 'sentence' (by individual sentence)
  theoryLevelFilter: 'all',
  theorySearch: '',
  answers: {},
  checked: {},
  orderSelection: [],
  activeRomanceVerse: 1,
  activeGrammarWord: 'w1',
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      storyMode: parsed.storyMode === 'sentence' ? 'sentence' : 'paragraph',
      answers: parsed.answers || {},
      checked: parsed.checked || {},
      orderSelection: Array.isArray(parsed.orderSelection) ? parsed.orderSelection : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
const openTranslations = new Set();
const openAnswers = new Set();

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeTab: state.activeTab,
        storyMode: state.storyMode,
        answers: state.answers,
        checked: state.checked,
        orderSelection: state.orderSelection,
        activeRomanceVerse: state.activeRomanceVerse,
        activeGrammarWord: state.activeGrammarWord,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// HTML & INTERACTIVE BILINGUAL HELPERS
// ============================================================================
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSentenceWithUnderline(es, underline) {
  if (!underline) return esc(es);
  const idx = es.toLowerCase().indexOf(underline.toLowerCase());
  if (idx === -1) return esc(es);
  const before = es.slice(0, idx);
  const match = es.slice(idx, idx + underline.length);
  const after = es.slice(idx + underline.length);
  return `${esc(before)}<span class="exam-underline">${esc(match)}</span>${esc(after)}`;
}

// Clickable Spanish phrase -> inline block Armenian translation (opens individually)
function esBlock(id, es, hy, extraClass = '') {
  const isOpen = openTranslations.has(id);
  return `
    <span class="inline-block max-w-full">
      <span
        role="button"
        tabindex="0"
        data-tr-toggle="${esc(id)}"
        aria-expanded="${isOpen ? 'true' : 'false'}"
        title="Haz clic para ver la traducción al armenio"
        class="es-click ${isOpen ? 'is-open' : ''} ${extraClass}"
      >${esc(es)}</span>
      <span data-tr-target="${esc(id)}" class="hy-reveal ${isOpen ? 'is-visible' : ''}">
        <span class="text-xs font-bold text-orange-700 mr-2 select-none">HY</span>${esc(hy)}
      </span>
    </span>
  `;
}

// Compact clickable Spanish text for table cells / short labels (opens individually)
function esCell(id, es, hy, extraClass = '') {
  const isOpen = openTranslations.has(id);
  return `
    <div>
      <span
        role="button"
        tabindex="0"
        data-tr-toggle="${esc(id)}"
        aria-expanded="${isOpen ? 'true' : 'false'}"
        title="Haz clic para ver la traducción al armenio"
        class="es-click ${isOpen ? 'is-open' : ''} ${extraClass}"
      >${esc(es)}</span>
      <div data-tr-target="${esc(id)}" class="hy-inline ${isOpen ? 'is-visible' : ''}">${esc(hy)}</div>
    </div>
  `;
}

// Render short multi-sentence text where EACH sentence clicks individually to open its own Armenian translation
function renderClickableSentences(prefix, sentences) {
  return `
    <div class="space-y-2.5">
      ${sentences
        .map((s, idx) => {
          const id = `${prefix}_s_${idx}`;
          const isOpen = openTranslations.has(id);
          return `
            <div>
              <span
                role="button"
                tabindex="0"
                data-tr-toggle="${esc(id)}"
                aria-expanded="${isOpen ? 'true' : 'false'}"
                title="Haz clic en la frase para ver la traducción al armenio"
                class="story-sent text-[17px] leading-[1.85] text-stone-900 ${isOpen ? 'is-active' : ''}"
              >${esc(s.es)}</span>
              <div data-tr-target="${esc(id)}" class="hy-reveal ${isOpen ? 'is-visible' : ''}">
                <span class="text-xs font-bold text-orange-700 mr-2 select-none">HY</span>${esc(s.hy)}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

// Speech synthesis for Spanish reading & practice
function speakSpanish(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-ES';
  utter.rate = 0.92;
  window.speechSynthesis.speak(utter);
}

// Render interactive reading story:
// Default: click ANY paragraph -> opens ONLY that paragraph's Armenian translation directly below it.
// Optional switch: click individual sentences -> opens ONLY that sentence's Armenian translation.
function renderStory(storyId, story, sectionNumEs, sectionNumHy) {
  const isSentenceMode = state.storyMode === 'sentence';
  const fullEsText = story.paragraphs.flat().map((s) => s.es).join(' ');

  const paragraphsHtml = story.paragraphs
    .map((para, pIdx) => {
      if (!isSentenceMode) {
        // Paragraph-by-paragraph click-to-translate
        const paraId = `story_para_${storyId}_${pIdx}`;
        const isOpen = openTranslations.has(paraId);
        const paraEsHtml = para
          .map((s) => formatSentenceWithUnderline(s.es, s.underline))
          .join(' ');
        const paraHy = para.map((s) => s.hy).join(' ');

        return `
          <div class="space-y-2">
            <div
              role="button"
              tabindex="0"
              data-tr-toggle="${esc(paraId)}"
              aria-expanded="${isOpen ? 'true' : 'false'}"
              title="Haz clic en el párrafo para ver la traducción al armenio"
              class="story-para ${isOpen ? 'is-open' : ''}"
            >
              <div class="flex items-start gap-3">
                <span class="font-mono-num text-xs font-semibold text-orange-700/80 mt-2 shrink-0 select-none">${pIdx + 1}.</span>
                <p class="text-[19px] md:text-[20px] leading-[1.9] text-stone-900">${paraEsHtml}</p>
              </div>
            </div>
            <div data-tr-target="${esc(paraId)}" class="hy-reveal ml-6 ${isOpen ? 'is-visible' : ''}">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-xs font-bold text-orange-700 mr-2 select-none">HY · Párrafo ${pIdx + 1}</span>
                  <span>${esc(paraHy)}</span>
                </div>
                <button type="button" data-tr-toggle="${esc(paraId)}" class="text-sm font-semibold text-orange-700 hover:text-orange-900 shrink-0 cursor-pointer">Cerrar</button>
              </div>
            </div>
          </div>
        `;
      }

      // Sentence-by-sentence mode: each sentence toggles its own translation directly below it
      return `
        <div class="space-y-2 pl-2">
          <div class="text-xs font-mono-num font-semibold text-stone-400">Párrafo ${pIdx + 1}</div>
          <div class="space-y-2.5">
            ${para
              .map((s, sIdx) => {
                const sId = `story_sent_${storyId}_${pIdx}_${sIdx}`;
                const isOpen = openTranslations.has(sId);
                return `
                  <div>
                    <span
                      role="button"
                      tabindex="0"
                      data-tr-toggle="${esc(sId)}"
                      aria-expanded="${isOpen ? 'true' : 'false'}"
                      title="Haz clic en la frase para ver la traducción al armenio"
                      class="story-sent text-[19px] md:text-[20px] leading-[1.9] text-stone-900 ${isOpen ? 'is-active' : ''}"
                    >${formatSentenceWithUnderline(s.es, s.underline)}</span>
                    <div data-tr-target="${esc(sId)}" class="hy-reveal ${isOpen ? 'is-visible' : ''}">
                      <span class="text-xs font-bold text-orange-700 mr-2 select-none">HY</span>${esc(s.hy)}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <article class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-9">
      <div class="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-orange-100">
        <div>
          <div class="text-sm font-medium text-stone-600 mb-1.5">
            ${esCell(
              `st_sub_${storyId}`,
              `${sectionNumEs} · ${
                isSentenceMode
                  ? 'Haz clic en cada frase para ver su traducción al armenio'
                  : 'Haz clic en cada párrafo para ver su traducción al armenio'
              }`,
              `${sectionNumHy} · ${
                isSentenceMode
                  ? 'Սեղմի՛ր առանձին նախադասության վրա՝ հայերեն թարգմանությունը տեսնելու համար'
                  : 'Սեղմի՛ր պարբերության վրա՝ միայն այդ պարբերության հայերեն թարգմանությունը բացելու համար'
              }`
            )}
          </div>
          <h2 class="text-2xl md:text-3xl font-bold text-stone-900 leading-tight">
            ${esBlock(`st_title_${storyId}`, story.titleEs, story.titleHy)}
          </h2>
        </div>
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <div class="flex items-center p-1 bg-orange-50 border border-orange-200 rounded-lg" role="group" aria-label="Modo de traducción">
            <button
              type="button"
              data-story-mode="paragraph"
              class="px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                !isSentenceMode ? 'bg-white text-orange-900 shadow-xs font-semibold' : 'text-stone-700 hover:text-stone-900'
              }"
            >Por párrafos</button>
            <button
              type="button"
              data-story-mode="sentence"
              class="px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                isSentenceMode ? 'bg-white text-orange-900 shadow-xs font-semibold' : 'text-stone-700 hover:text-stone-900'
              }"
            >Por frases</button>
          </div>
          <button
            type="button"
            data-speak="${esc(fullEsText)}"
            class="px-4 py-2 text-sm font-medium text-stone-800 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >Escuchar (ES)</button>
        </div>
      </div>

      <div class="mt-6 space-y-4 max-w-[70ch]">
        ${paragraphsHtml}
      </div>

      <div class="mt-7 pt-4 border-t border-orange-100 text-sm text-stone-600">
        ${esCell(`st_note_${storyId}`, story.noteEs, story.noteHy)}
      </div>
    </article>
  `;
}

// Render open exam questions A–F with textarea + model answer reveal
function renderQuestionsAF(prefix, questions) {
  return `
    <div class="space-y-5">
      ${questions
        .map((q) => {
          const ansKey = `${prefix}_af_${q.letter}`;
          const isRevealed = openAnswers.has(ansKey);
          const studentVal = state.answers[ansKey] || '';

          const modelHtml = q.aParts
            ? `<div class="space-y-3">
                ${q.aParts
                  .map(
                    (part, idx) => `
                  <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg space-y-1.5">
                    <div class="font-semibold text-stone-900 text-base">${esCell(`${ansKey}_pt_${idx}`, part.termEs, part.termHy)}</div>
                    <div class="text-base text-stone-800">${esBlock(`${ansKey}_pb_${idx}`, part.es, part.hy)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : `<div class="text-base leading-relaxed text-stone-900">
                ${esBlock(`${ansKey}_model`, q.aEs, q.aHy)}
              </div>`;

          return `
            <div class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7">
              <div class="flex items-baseline justify-between gap-4 mb-3.5">
                <div class="flex items-baseline gap-2.5">
                  <span class="font-mono-num text-base font-bold text-orange-700">${esc(q.letter)})</span>
                  <div class="text-[17px] font-semibold text-stone-900 leading-snug">
                    ${esBlock(`${ansKey}_q`, q.qEs, q.qHy)}
                  </div>
                </div>
                <span class="text-sm text-stone-500 font-mono-num whitespace-nowrap shrink-0">${esc(q.points)}</span>
              </div>

              <textarea
                rows="3"
                data-input-key="${esc(ansKey)}"
                placeholder="Escribe tu respuesta en español (ej.: El texto cuenta la historia de...)"
                class="w-full mt-2 px-4 py-3 text-base text-stone-900 bg-[#fffbf7] border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:border-orange-600 focus:ring-2 focus:ring-orange-200 transition-colors"
              >${esc(studentVal)}</textarea>

              <div class="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  data-toggle-ans="${esc(ansKey)}"
                  class="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isRevealed
                      ? 'bg-stone-900 text-white hover:bg-stone-800'
                      : 'bg-white text-stone-800 border border-stone-300 hover:bg-orange-50'
                  }"
                >${isRevealed ? 'Ocultar respuesta modelo' : 'Ver respuesta modelo'}</button>
                ${
                  studentVal.trim()
                    ? `<button type="button" data-clear-input="${esc(ansKey)}" class="text-sm text-stone-600 hover:text-stone-900 cursor-pointer">Limpiar</button>`
                    : ''
                }
              </div>

              ${
                isRevealed
                  ? `<div class="mt-5 pt-4 border-t border-orange-100 space-y-3">
                       <div class="text-sm font-semibold text-emerald-800">
                         ${esCell(`${ansKey}_mh`, 'Respuesta modelo (haz clic en el texto español para traducir)', 'Օրինակ պատասխան (սեղմի՛ր իսպաներենի վրա՝ հայերենը տեսնելու համար)')}
                       </div>
                       ${modelHtml}
                       ${
                         q.tipEs
                           ? `<div class="text-sm leading-relaxed text-stone-800 bg-orange-50/50 border border-orange-200/70 rounded-lg p-3.5">
                                ${esBlock(`${ansKey}_tip`, q.tipEs, q.tipHy)}
                              </div>`
                           : ''
                       }
                     </div>`
                  : ''
              }
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

// ============================================================================
// VIEW 1: EXAMEN 1 — UNA AMISTAD INESPERADA
// ============================================================================
function renderExam1() {
  const resumenChecked = !!state.checked['exam1_resumen'];
  const figChecked = !!state.checked['exam1_figuras'];

  const resumenScore = EXAM_1.resumenGuide.quiz.reduce(
    (acc, q) => acc + (state.answers[q.id] === q.correct ? 1 : 0),
    0
  );
  const figScore = EXAM_1.figurasQuiz.items.reduce(
    (acc, q) => acc + (state.answers[q.id] === q.correct ? 1 : 0),
    0
  );

  return `
    <div class="space-y-10">
      <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
        <div class="text-sm font-medium text-stone-600">${esCell('e1_meta', EXAM_1.metaEs, EXAM_1.metaHy)}</div>
        <h1 class="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight leading-tight">
          ${esBlock('e1_h1', EXAM_1.titleEs, EXAM_1.titleHy)}
        </h1>
        <p class="text-base text-stone-700 max-w-3xl leading-relaxed">
          Կարդա՛ տեքստը, սեղմի՛ր ցանկացած պարբերության, նախադասության կամ հարցի վրա՝ հայերեն թարգմանությունը բացելու համար, ապա պատասխանի՛ր A–F հարցերին և կատարի՛ր վարժությունները։
        </p>
      </header>

      <!-- 1. Reading Passage -->
      <section class="space-y-6">
        ${renderStory('exam1', EXAM_1.story, 'Parte 1 · 6 puntos', 'Բաժին 1 · 6 միավոր')}
      </section>

      <!-- Parte A-F -->
      <section class="space-y-4">
        <div>
          <p class="text-sm text-stone-600">Parte 1 · 6 puntos</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900 mt-0.5">
            ${esBlock('e1_af_title', 'Parte A–F. Preguntas del examen', 'Մաս A–F․ Քննության հարցեր')}
          </h2>
        </div>
        ${renderQuestionsAF('exam1', EXAM_1.questionsAF)}
      </section>

      <!-- Cómo aprender a resumir un texto -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-8">
        <div class="space-y-1.5">
          <p class="text-sm text-stone-600">Guía de resumen</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900">
            ${esBlock('e1_res_title', 'Cómo aprender a resumir un texto', 'Ինչպե՞ս սովորել ամփոփել տեքստը (Resumen)')}
          </h2>
          <div class="text-base text-stone-700 leading-relaxed">
            ${esBlock(
              'e1_res_intro',
              'No hace falta repetir cada frase del texto. Solo hay que encontrar las tres ideas principales y unirlas en 2 o 3 frases.',
              'Պետք չէ վերապատմել յուրաքանչյուր նախադասություն։ Անհրաժեշտ է գտնել երեք գլխավոր գաղափարները և միավորել 2–3 նախադասության մեջ։'
            )}
          </div>
        </div>

        <!-- Paso 1 Table -->
        <div class="space-y-3">
          <h3 class="text-lg font-semibold text-stone-900">
            ${esBlock('e1_p1', 'Paso 1. Responde a tres preguntas', 'Քայլ 1․ Պատասխանի՛ր երեք հարցի')}
          </h3>
          <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
            <table class="w-full text-left text-base">
              <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                <tr>
                  <th class="px-4 py-3.5">Pregunta</th>
                  <th class="px-4 py-3.5">Respuesta</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-orange-100">
                ${EXAM_1.resumenGuide.step1Rows
                  .map(
                    (row, idx) => `
                  <tr>
                    <td class="px-4 py-4 align-top font-semibold text-stone-900">${esCell(`r_s1_q${idx}`, row.qEs, row.qHy)}</td>
                    <td class="px-4 py-4 align-top text-stone-800">${esCell(`r_s1_a${idx}`, row.aEs, row.aHy)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paso 2 Model & Rules -->
        <div class="grid md:grid-cols-2 gap-6">
          <div class="p-5 bg-orange-50/40 border border-orange-200/80 rounded-lg space-y-3.5">
            <h3 class="text-lg font-semibold text-stone-900">
              ${esCell('e1_p2', 'Paso 2. Une las respuestas — Modelo de resumen', 'Քայլ 2․ Միավորի՛ր պատասխանները — Ամփոփման օրինակ')}
            </h3>
            <div class="text-base leading-relaxed text-stone-900">
              ${esBlock('e1_res_model', EXAM_1.resumenGuide.modelEs, EXAM_1.resumenGuide.modelHy)}
            </div>
            <div class="pt-3.5 border-t border-orange-200/70 space-y-2.5">
              <div class="text-sm font-semibold text-stone-600">
                ${esCell('e1_ss_h', 'Paso a paso en 3 frases sencillas:', 'Քայլ առ քայլ 3 պարզ նախադասությամբ․')}
              </div>
              ${EXAM_1.resumenGuide.stepSentences
                .map(
                  (s, i) => `
                <div class="text-base text-stone-800">${i + 1}. ${esCell(`e1_ss_${i}`, s.es, s.hy)}</div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="p-5 bg-orange-50/40 border border-orange-200/80 rounded-lg space-y-3.5">
            <h3 class="text-lg font-semibold text-stone-900">
              ${esCell('e1_rules_h', 'Las 4 reglas del resumen', 'Ամփոփման 4 կանոնները')}
            </h3>
            <ul class="space-y-3.5 text-base text-stone-800">
              ${EXAM_1.resumenGuide.rules
                .map(
                  (r, i) => `
                <li class="flex items-start gap-2.5">
                  <span class="font-mono-num text-sm font-bold text-orange-700 mt-0.5">0${i + 1}.</span>
                  <div>${esCell(`e1_rule_${i}`, r.es, r.hy)}</div>
                </li>
              `
                )
                .join('')}
            </ul>
            <div class="text-sm text-stone-700 pt-3 border-t border-orange-200/70 leading-relaxed">
              ${esBlock(
                'e1_rules_note',
                'Importante: en un resumen solo debes contar las ideas principales, no volver a escribir todo el texto.',
                'Կարևոր է․ ամփոփման մեջ պետք է ներկայացնել միայն գլխավոր իրադարձությունները, ոչ թե վերապատմել ամբողջ տեքստը։'
              )}
            </div>
          </div>
        </div>

        <!-- Practice Resumen Quiz -->
        <div class="pt-5 border-t border-orange-200/80 space-y-5">
          <div>
            <h3 class="text-xl font-semibold text-stone-900">
              ${esCell('e1_prac_h', 'Práctica: construye tu resumen paso a paso', 'Պրակտիկա․ կազմի՛ր ամփոփումը ինքնուրույն')}
            </h3>
            <div class="text-base text-stone-700 mt-1">
              ${esCell('e1_prac_sub', 'Elige la respuesta correcta en cada pregunta y comprueba tus resultados.', 'Ընտրի՛ր ճիշտ պատասխանները և ստուգի՛ր՝ պատրաստ լինելու ամփոփմանը։')}
            </div>
          </div>
          <div class="grid md:grid-cols-2 gap-4">
            ${EXAM_1.resumenGuide.quiz
              .map((q) => {
                const chosen = state.answers[q.id];
                return `
                  <div class="p-5 border border-orange-200/80 rounded-lg space-y-3.5 bg-[#fffbf7]/50">
                    <div class="text-base font-semibold text-stone-900">${esCell(`rq_${q.id}`, q.qEs, q.qHy)}</div>
                    <div class="space-y-2.5">
                      ${q.options
                        .map((opt, idx) => {
                          const isSelected = chosen === idx;
                          const isCorrect = idx === q.correct;
                          let cls = 'border-stone-200 bg-white hover:bg-orange-50/60 text-stone-900';
                          let statusLabel = '';
                          if (resumenChecked) {
                            if (isCorrect) {
                              cls = 'border-emerald-600 bg-emerald-50 text-emerald-950';
                              statusLabel = '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>';
                            } else if (isSelected && !isCorrect) {
                              cls = 'border-rose-500 bg-rose-50 text-rose-950';
                              statusLabel = '<span class="text-sm font-semibold text-rose-800">✕ Incorrecto</span>';
                            }
                          } else if (isSelected) {
                            cls = 'border-orange-600 bg-orange-50 text-orange-950';
                          }
                          const optTrId = `rq_opt_${q.id}_${idx}`;
                          const optOpen = openTranslations.has(optTrId);
                          return `
                            <div class="border rounded-lg transition-colors ${cls}">
                              <div class="flex items-center justify-between gap-2 px-3.5 py-3">
                                <div class="flex items-center gap-3 flex-1">
                                  <button
                                    type="button"
                                    data-select-ans="${esc(q.id)}"
                                    data-select-val="${idx}"
                                    aria-label="Seleccionar opción"
                                    class="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer ${
                                      isSelected ? 'border-orange-700 bg-orange-700' : 'border-stone-400 hover:border-orange-600 bg-white'
                                    }"
                                  >
                                    ${isSelected ? '<span class="w-2.5 h-2.5 rounded-full bg-white"></span>' : ''}
                                  </button>
                                  <span
                                    role="button"
                                    tabindex="0"
                                    data-tr-toggle="${esc(optTrId)}"
                                    title="Haz clic para ver la traducción al armenio"
                                    class="es-click text-[15px] leading-snug ${optOpen ? 'is-open' : ''}"
                                  >${esc(opt.es)}</span>
                                </div>
                                ${statusLabel ? `<div class="shrink-0">${statusLabel}</div>` : ''}
                              </div>
                              <div data-tr-target="${esc(optTrId)}" class="hy-inline px-4 pb-3 pl-13 ${optOpen ? 'is-visible' : ''}">${esc(opt.hy)}</div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-check-group="exam1_resumen"
              class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg transition-colors cursor-pointer"
            >Comprobar respuestas</button>
            <button
              type="button"
              data-reset-group="exam1_resumen"
              data-reset-keys="${EXAM_1.resumenGuide.quiz.map((q) => q.id).join(',')}"
              class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
            >Reiniciar</button>
            ${
              resumenChecked
                ? `<span class="text-base font-bold font-mono-num text-stone-900">Resultado: ${resumenScore} / 4</span>`
                : ''
            }
          </div>
        </div>
      </section>

      <!-- Parte 2: Figuras literarias (3 puntos) -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-6">
        <div class="space-y-1">
          <p class="text-sm text-stone-600">Parte 2 · 3 puntos</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900">
            ${esBlock('e1_fig_h2', '2. Figuras literarias — Elige la figura literaria correcta', '2. Գրական պատկերավորման միջոցներ — Ընտրի՛ր ճիշտ տարբերակը')}
          </h2>
        </div>

        <div class="space-y-5">
          ${EXAM_1.figurasQuiz.items
            .map((item) => {
              const chosen = state.answers[item.id];
              return `
                <div class="p-5 border border-orange-200/80 rounded-lg space-y-3.5 bg-[#fffbf7]/40">
                  <div class="text-[17px] font-semibold text-stone-900 leading-snug">
                    ${esBlock(`e1fig_${item.id}`, item.es, item.hy)}
                  </div>
                  <div class="flex flex-wrap gap-2">
                    ${EXAM_1.figurasQuiz.options
                      .map((opt, idx) => {
                        const isSelected = chosen === idx;
                        const isCorrect = idx === item.correct;
                        let btnCls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                        let mark = '';
                        if (figChecked) {
                          if (isCorrect) {
                            btnCls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                            mark = '✓ ';
                          } else if (isSelected && !isCorrect) {
                            btnCls = 'bg-rose-50 border-rose-500 text-rose-950';
                            mark = '✕ ';
                          }
                        } else if (isSelected) {
                          btnCls = 'bg-orange-700 border-orange-700 text-white font-medium';
                        }
                        return `
                          <button
                            type="button"
                            data-select-ans="${esc(item.id)}"
                            data-select-val="${idx}"
                            class="px-4 py-2.5 text-sm md:text-[15px] border rounded-lg transition-colors cursor-pointer whitespace-nowrap ${btnCls}"
                          >${mark}${esc(opt.es)}</button>
                        `;
                      })
                      .join('')}
                  </div>
                  ${
                    figChecked
                      ? `<div class="pt-3 border-t border-orange-100 text-base text-stone-800">
                           ${esBlock(`e1fig_exp_${item.id}`, item.expEs, item.expHy)}
                         </div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-check-group="exam1_figuras"
            class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg transition-colors cursor-pointer"
          >Ver respuestas y explicaciones</button>
          <button
            type="button"
            data-reset-group="exam1_figuras"
            data-reset-keys="${EXAM_1.figurasQuiz.items.map((i) => i.id).join(',')}"
            class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
          >Reiniciar</button>
          ${
            figChecked
              ? `<span class="text-base font-bold font-mono-num text-stone-900">Resultado: ${figScore} / 6</span>`
              : ''
          }
        </div>
      </section>

      <!-- Mini Cheat Sheet -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-4">
        <h2 class="text-2xl font-bold text-stone-900">
          ${esCell('e1_cs_h', 'Mini chuleta para el examen', 'Մինի հուշաթերթիկ քննության համար')}
        </h2>
        <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
          <table class="w-full text-left text-base">
            <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
              <tr>
                <th class="px-4 py-3.5">Figura literaria</th>
                <th class="px-4 py-3.5">Cómo reconocerla rápido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-orange-100">
              ${EXAM_1.miniCheatSheet
                .map(
                  (row, i) => `
                <tr>
                  <td class="px-4 py-3.5 font-semibold text-stone-900">${esCell(`cs1_${i}`, row.es, row.hy)}</td>
                  <td class="px-4 py-3.5 text-stone-800">${esCell(`cs1_clue_${i}`, row.clueEs, row.clueHy)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

// ============================================================================
// VIEW 2: SIMULACRO 2 — LA BIBLIOTECA DE LOS SUEÑOS & EJERCICIOS 1–9
// ============================================================================
function renderExam2() {
  const ex2Checked = !!state.checked['ex2_resumen'];
  const ex3Checked = !!state.checked['ex3_order'];
  const ex5Checked = !!state.checked['ex5_figuras'];
  const ex6Checked = !!state.checked['ex6_generos'];
  const ex7Checked = !!state.checked['ex7_culta'];
  const ex8Checked = !!state.checked['ex8_blanks'];

  const orderPoolIds = ['o3', 'o1', 'o4', 'o2'];
  const orderMap = Object.fromEntries(EXAM_2.ex3OrderIdeas.correctOrder.map((x) => [x.id, x]));
  const selectedIds = state.orderSelection;
  const remainingIds = orderPoolIds.filter((id) => !selectedIds.includes(id));
  const isOrderCorrect =
    selectedIds.length === 4 &&
    selectedIds.every((id, idx) => id === EXAM_2.ex3OrderIdeas.correctOrder[idx].id);

  const ex5Score = EXAM_2.ex5Figuras.reduce((a, q) => a + (state.answers[q.id] === q.correct ? 1 : 0), 0);
  const ex8Score = EXAM_2.ex8FillBlanks.items.reduce(
    (a, q) => a + ((state.answers[q.id] || '').trim().toLowerCase() === q.answer ? 1 : 0),
    0
  );

  return `
    <div class="space-y-10">
      <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
        <div class="text-sm font-medium text-stone-600">${esCell('e2_meta', EXAM_2.metaEs, EXAM_2.metaHy)}</div>
        <h1 class="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight leading-tight">
          ${esBlock('e2_h1', EXAM_2.titleEs, EXAM_2.titleHy)}
        </h1>
        <p class="text-base text-stone-700 max-w-3xl leading-relaxed">
          Երկրորդ լիարժեք տեքստը և 9 գործնական վարժություն՝ ամփոփում (Resumen), գեղարվեստական միջոցներ, գրական սեռեր և պատասխանների հիմնավորում։
        </p>
      </header>

      <!-- Parte 1: Reading & Ex 1 -->
      <section class="space-y-6">
        ${renderStory('exam2', EXAM_2.story, 'Parte 1 · Ejercicio 1 · 6 puntos', 'Մաս 1 · Վարժություն 1 · 6 միավոր')}
        <div>
          <h2 class="text-2xl font-bold text-stone-900 mb-4">
            ${esBlock('e2_q_title', 'Ejercicio 1. Comprensión y análisis (A–F)', 'Վարժություն 1․ Տեքստի ընկալում և վերլուծություն (A–F)')}
          </h2>
          ${renderQuestionsAF('exam2', EXAM_2.questionsAF)}
        </div>
      </section>

      <!-- Parte 2: Aprende a escribir un resumen (Ex 2, 3, 4) -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-8">
        <div>
          <p class="text-sm text-stone-600">Parte 2 · Taller de resumen</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900 mt-0.5">
            ${esBlock('e2_p2_h', 'Aprende a escribir un resumen', 'Սովորի՛ր գրել տեքստի ամփոփում (Resumen)')}
          </h2>
        </div>

        <!-- Ejercicio 2 -->
        <div class="space-y-4 pb-8 border-b border-orange-100">
          <h3 class="text-xl font-semibold text-stone-900">
            ${esCell('e2_ex2_t', 'Ejercicio 2. Elige el mejor resumen', 'Վարժություն 2․ Ընտրի՛ր լավագույն ամփոփումը')}
          </h3>
          <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg">
            ${renderClickableSentences('e2_ex2_txt', EXAM_2.ex2BestResumen.sentences)}
          </div>
          <div class="text-base font-semibold text-stone-900">
            ${esCell('e2_ex2_q', EXAM_2.ex2BestResumen.questionEs, EXAM_2.ex2BestResumen.questionHy)}
          </div>
          <div class="space-y-2.5">
            ${EXAM_2.ex2BestResumen.options
              .map((opt, idx) => {
                const isSelected = state.answers['ex2_best'] === idx;
                const isCorrect = idx === EXAM_2.ex2BestResumen.correct;
                let cls = 'border-stone-200 bg-white hover:bg-orange-50/50';
                let status = '';
                if (ex2Checked) {
                  if (isCorrect) {
                    cls = 'border-emerald-600 bg-emerald-50';
                    status = '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>';
                  } else if (isSelected) {
                    cls = 'border-rose-500 bg-rose-50';
                    status = '<span class="text-sm font-semibold text-rose-800">✕ Incorrecto</span>';
                  }
                } else if (isSelected) {
                  cls = 'border-orange-600 bg-orange-50';
                }
                const trId = `ex2_opt_${idx}`;
                const open = openTranslations.has(trId);
                return `
                  <div class="border rounded-lg ${cls}">
                    <div class="flex items-start justify-between gap-3 p-4">
                      <div class="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          data-select-ans="ex2_best"
                          data-select-val="${idx}"
                          aria-label="Seleccionar opción ${opt.letter}"
                          class="w-8 h-8 rounded-lg border font-mono-num text-sm font-bold flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-orange-700 border-orange-700 text-white'
                              : 'bg-white border-stone-300 text-orange-800 hover:border-orange-600'
                          }"
                        >${opt.letter}</button>
                        <span
                          role="button"
                          tabindex="0"
                          data-tr-toggle="${trId}"
                          title="Haz clic para ver la traducción al armenio"
                          class="es-click text-base text-stone-900 pt-0.5 ${open ? 'is-open' : ''}"
                        >${esc(opt.es)}</span>
                      </div>
                      ${status ? `<div class="shrink-0 pt-1">${status}</div>` : ''}
                    </div>
                    <div data-tr-target="${trId}" class="hy-inline px-4 pb-3.5 pl-15 ${open ? 'is-visible' : ''}">${esc(opt.hy)}</div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex items-center gap-3">
            <button type="button" data-check-group="ex2_resumen" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
            <button type="button" data-reset-group="ex2_resumen" data-reset-keys="ex2_best" class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg cursor-pointer">Reiniciar</button>
          </div>
          ${
            ex2Checked
              ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-base text-emerald-950">
                   ${esBlock('ex2_exp', EXAM_2.ex2BestResumen.expEs, EXAM_2.ex2BestResumen.expHy)}
                 </div>`
              : ''
          }
        </div>

        <!-- Ejercicio 3: Ordena las ideas -->
        <div class="space-y-4 pb-8 border-b border-orange-100">
          <h3 class="text-xl font-semibold text-stone-900">
            ${esCell('e2_ex3_t', 'Ejercicio 3. Ordena las ideas', 'Վարժություն 3․ Դասավորի՛ր գաղափարները ճիշտ հերթականությամբ')}
          </h3>
          <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg">
            ${renderClickableSentences('e2_ex3_txt', EXAM_2.ex3OrderIdeas.sentences)}
          </div>
          <div class="text-sm text-stone-600">
            ${esCell(
              'e2_ex3_hint',
              'Pulsa «+ Añadir» para ordenar las frases correctamente (haz clic en cada frase para ver la traducción al armenio).',
              'Սեղմի՛ր «+ Ավելացնել»՝ նախադասությունները ճիշտ հերթականությամբ շարելու համար (իսպաներեն տեքստի վրա սեղմելիս կբացվի հայերենը)։'
            )}
          </div>

          <!-- Selected sequence -->
          <div class="p-4 border border-dashed border-orange-300 rounded-lg bg-orange-50/40 space-y-2.5 min-h-[84px]">
            <p class="text-sm font-medium text-stone-600">Tu orden (${selectedIds.length} / 4):</p>
            ${
              selectedIds.length === 0
                ? '<p class="text-sm text-stone-500">Aún no has seleccionado ninguna frase. Elige una de la lista de abajo.</p>'
                : selectedIds
                    .map((id, idx) => {
                      const item = orderMap[id];
                      return `
                        <div class="flex items-center justify-between gap-3 p-3.5 bg-white border border-orange-200 rounded-lg text-base">
                          <div class="flex items-baseline gap-2.5">
                            <span class="font-mono-num text-sm font-bold text-orange-700">${idx + 1}.</span>
                            <span>${esCell(`ord_sel_${id}`, item.es, item.hy)}</span>
                          </div>
                          <button type="button" data-order-remove="${id}" class="text-sm text-stone-600 hover:text-rose-700 cursor-pointer shrink-0">Quitar</button>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>

          <!-- Remaining pool -->
          ${
            remainingIds.length > 0
              ? `<div class="space-y-2.5">
                   ${remainingIds
                     .map((id) => {
                       const item = orderMap[id];
                       return `
                         <div class="flex items-center justify-between gap-3 p-3.5 bg-white border border-stone-200 rounded-lg text-base hover:border-orange-300">
                           <div>${esCell(`ord_pool_${id}`, item.es, item.hy)}</div>
                           <button type="button" data-order-add="${id}" class="px-3.5 py-2 text-sm font-medium text-orange-800 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-md cursor-pointer shrink-0 whitespace-nowrap">+ Añadir</button>
                         </div>
                       `;
                     })
                     .join('')}
                 </div>`
              : ''
          }

          <div class="flex flex-wrap items-center gap-3">
            <button type="button" data-check-group="ex3_order" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
            <button type="button" data-order-reset="1" class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg cursor-pointer">Reiniciar</button>
          </div>
          ${
            ex3Checked
              ? `<div class="p-4 rounded-lg border text-base space-y-2.5 ${
                  isOrderCorrect
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }">
                   <div class="font-semibold">${
                     isOrderCorrect
                       ? esCell('ex3_ok', '✓ ¡Muy bien! El orden es correcto.', '✓ Հիանալի է․ հերթականությունը ճիշտ է։')
                       : esBlock(
                           'ex3_err',
                           '✕ Inténtalo de nuevo: primero el deseo de Carlos, después la ayuda del abuelo, luego la primera canción y al final la alegría.',
                           '✕ Փորձի՛ր նորից․ նախ պետք է լինի Կառլոսի ցանկությունը, հետո պապիկի օգնությունը, ապա առաջին երգը և վերջում ուրախությունը։'
                         )
                   }</div>
                   <div class="pt-2 border-t border-stone-200/70">
                     <div class="text-sm font-medium text-stone-600 mb-1">
                       ${esCell('ex3_mod_h', 'Modelo de resumen breve:', 'Պատրաստի կարճ ամփոփման օրինակ․')}
                     </div>
                     ${esBlock('ex3_mod', EXAM_2.ex3OrderIdeas.modelEs, EXAM_2.ex3OrderIdeas.modelHy)}
                   </div>
                 </div>`
              : ''
          }
        </div>

        <!-- Ejercicio 4: Escribe tu propio resumen -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold text-stone-900">
            ${esCell('e2_ex4_t', 'Ejercicio 4. Escribe tu propio resumen', 'Վարժություն 4․ Գրի՛ր քո սեփական ամփոփումը')}
          </h3>
          <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg">
            ${renderClickableSentences('e2_ex4_txt', EXAM_2.ex4WriteResumen.sentences)}
          </div>
          <div class="grid sm:grid-cols-2 gap-3 text-base">
            ${EXAM_2.ex4WriteResumen.guideQuestions
              .map(
                (gq, i) => `
              <div class="p-3.5 border border-orange-200/80 rounded-lg bg-white">
                ${esCell(`e2_ex4_g${i}`, gq.es, gq.hy)}
              </div>
            `
              )
              .join('')}
          </div>
          <textarea
            rows="3"
            data-input-key="ex4_sofia_resumen"
            placeholder="Escribe 2 o 3 frases en español..."
            class="w-full px-4 py-3 text-base bg-[#fffbf7] border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:border-orange-600 focus:ring-2 focus:ring-orange-200"
          >${esc(state.answers['ex4_sofia_resumen'] || '')}</textarea>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" data-toggle-ans="ex4_model" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">
              ${openAnswers.has('ex4_model') ? 'Ocultar modelo' : 'Ver modelo'}
            </button>
            <button type="button" data-clear-input="ex4_sofia_resumen" class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg cursor-pointer">Limpiar</button>
          </div>
          ${
            openAnswers.has('ex4_model')
              ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-base">
                   <div class="text-sm font-semibold text-emerald-800 mb-1.5">
                     ${esCell('e2_ex4_mh', 'Resumen modelo:', 'Օրինակ ամփոփում․')}
                   </div>
                   ${esBlock('e2_ex4_mod', EXAM_2.ex4WriteResumen.modelEs, EXAM_2.ex4WriteResumen.modelHy)}
                 </div>`
              : ''
          }
        </div>
      </section>

      <!-- Parte 3: Ejercicio 5 Figuras literarias (8 items) -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-6">
        <div>
          <p class="text-sm text-stone-600">Parte 3 · Ejercicio 5</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900 mt-0.5">
            ${esBlock('e2_ex5_h', 'Ejercicio 5. Identifica la figura literaria', 'Վարժություն 5․ Ընտրի՛ր ճիշտ գեղարվեստական միջոցը')}
          </h2>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          ${EXAM_2.ex5Figuras
            .map((item) => {
              const chosen = state.answers[item.id];
              return `
                <div class="p-5 border border-orange-200/80 rounded-lg space-y-3.5 bg-[#fffbf7]/40">
                  <div class="text-base font-semibold text-stone-900">${esBlock(`e5_${item.id}`, item.es, item.hy)}</div>
                  <div class="flex flex-wrap gap-2">
                    ${item.options
                      .map((opt, idx) => {
                        const isSel = chosen === idx;
                        const isCor = idx === item.correct;
                        let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                        let mark = '';
                        if (ex5Checked) {
                          if (isCor) {
                            cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                            mark = '✓ ';
                          } else if (isSel) {
                            cls = 'bg-rose-50 border-rose-500 text-rose-950';
                            mark = '✕ ';
                          }
                        } else if (isSel) {
                          cls = 'bg-orange-700 border-orange-700 text-white';
                        }
                        return `<button type="button" data-select-ans="${item.id}" data-select-val="${idx}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${esc(opt.es)}</button>`;
                      })
                      .join('')}
                  </div>
                  ${
                    ex5Checked
                      ? `<div class="pt-2.5 border-t border-orange-100 text-sm text-stone-800">
                           ${esBlock(`e5_j_${item.id}`, item.justEs, item.justHy)}
                         </div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button type="button" data-check-group="ex5_figuras" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar todo</button>
          <button type="button" data-reset-group="ex5_figuras" data-reset-keys="${EXAM_2.ex5Figuras.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg cursor-pointer">Reiniciar</button>
          ${ex5Checked ? `<span class="text-base font-bold font-mono-num text-stone-900">Resultado: ${ex5Score} / 8</span>` : ''}
        </div>
      </section>

      <!-- Parte 4: Ejercicios 6 & 7 -->
      <section class="grid lg:grid-cols-2 gap-6">
        <!-- Ejercicio 6 -->
        <div class="bg-white border border-orange-200/80 rounded-xl p-6 space-y-5">
          <div>
            <p class="text-sm text-stone-600">Parte 4 · Ejercicio 6</p>
            <h2 class="text-xl font-bold text-stone-900 mt-0.5">
              ${esCell('e2_ex6_h', 'Narrativo, lírico o dramático', 'Որոշի՛ր գրական սեռը')}
            </h2>
          </div>
          <div class="space-y-4">
            ${EXAM_2.ex6Generos
              .map((item) => {
                const chosen = state.answers[item.id];
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-3 bg-[#fffbf7]/40">
                    <div class="text-base font-medium text-stone-900">${esBlock(`e6_${item.id}`, item.es, item.hy)}</div>
                    <div class="flex flex-wrap gap-2">
                      ${['Narrativo', 'Lírico', 'Dramático']
                        .map((g) => {
                          const isSel = chosen === g;
                          const isCor = g === item.correct;
                          let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                          let mark = '';
                          if (ex6Checked) {
                            if (isCor) {
                              cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                              mark = '✓ ';
                            } else if (isSel) {
                              cls = 'bg-rose-50 border-rose-500 text-rose-950';
                              mark = '✕ ';
                            }
                          } else if (isSel) {
                            cls = 'bg-orange-700 border-orange-700 text-white';
                          }
                          return `<button type="button" data-select-ans="${item.id}" data-select-val="${g}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${g}</button>`;
                        })
                        .join('')}
                    </div>
                    ${
                      ex6Checked
                        ? `<div class="pt-2.5 border-t border-orange-100 text-sm text-stone-800">${esBlock(`e6_j_${item.id}`, item.justEs, item.justHy)}</div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex gap-2.5">
            <button type="button" data-check-group="ex6_generos" class="px-4 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Ver respuestas</button>
            <button type="button" data-reset-group="ex6_generos" data-reset-keys="${EXAM_2.ex6Generos.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
          </div>
        </div>

        <!-- Ejercicio 7 -->
        <div class="bg-white border border-orange-200/80 rounded-xl p-6 space-y-5">
          <div>
            <p class="text-sm text-stone-600">Parte 4 · Ejercicio 7</p>
            <h2 class="text-xl font-bold text-stone-900 mt-0.5">
              ${esCell('e2_ex7_h', 'Literatura culta o popular', 'Հեղինակային, թե՞ ժողովրդական գրականություն')}
            </h2>
          </div>
          <div class="space-y-4">
            ${EXAM_2.ex7CultaPopular
              .map((item) => {
                const chosen = state.answers[item.id];
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-3 bg-[#fffbf7]/40">
                    <div class="text-base font-medium text-stone-900">${esBlock(`e7_${item.id}`, item.es, item.hy)}</div>
                    <div class="flex flex-wrap gap-2">
                      ${['Culta', 'Popular']
                        .map((opt) => {
                          const isSel = chosen === opt;
                          const isCor = opt === item.correct;
                          let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                          let mark = '';
                          if (ex7Checked) {
                            if (isCor) {
                              cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                              mark = '✓ ';
                            } else if (isSel) {
                              cls = 'bg-rose-50 border-rose-500 text-rose-950';
                              mark = '✕ ';
                            }
                          } else if (isSel) {
                            cls = 'bg-orange-700 border-orange-700 text-white';
                          }
                          return `<button type="button" data-select-ans="${item.id}" data-select-val="${opt}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${opt}</button>`;
                        })
                        .join('')}
                    </div>
                    ${
                      ex7Checked
                        ? `<div class="pt-2.5 border-t border-orange-100 text-sm text-stone-800">${esBlock(`e7_j_${item.id}`, item.justEs, item.justHy)}</div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex gap-2.5">
            <button type="button" data-check-group="ex7_culta" class="px-4 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Ver respuestas</button>
            <button type="button" data-reset-group="ex7_culta" data-reset-keys="${EXAM_2.ex7CultaPopular.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
          </div>
        </div>
      </section>

      <!-- Parte 5: Ejercicio 8 & Ejercicio 9 -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-8">
        <div>
          <p class="text-sm text-stone-600">Parte 5 · Ejercicios de justificación</p>
          <h2 class="text-2xl md:text-[28px] font-bold text-stone-900 mt-0.5">
            ${esBlock('e2_p5_h', 'Aprende a justificar tus respuestas', 'Սովորի՛ր հիմնավորել քո պատասխանները (porque...)')}
          </h2>
          <div class="text-base text-stone-700 mt-1.5 leading-relaxed">
            ${esBlock(
              'e2_p5_intro',
              'En el examen no basta con escribir solo «Narrativo», «Metáfora» o «Sí». Siempre hay que explicar por qué usando «porque…».',
              'Քննության ժամանակ բավարար չէ գրել միայն «Narrativo», «Metáfora» կամ «Sí»։ Պետք է պարտադիր բացատրել՝ ինչու (porque...)։'
            )}
          </div>
        </div>

        <!-- Ejercicio 8 -->
        <div class="space-y-4 pb-8 border-b border-orange-100">
          <h3 class="text-xl font-semibold text-stone-900">
            ${esCell('e2_ex8_t', 'Ejercicio 8. Completa las justificaciones', 'Վարժություն 8․ Լրացրո՛ւ բաց թողնված բառերը')}
          </h3>
          <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg">
            <div class="text-sm font-medium text-stone-600 mb-2.5">
              ${esCell('e2_wb_h', 'Banco de palabras (haz clic en cada palabra para ver su traducción):', 'Բառերի բանկ (սեղմի՛ր իսպաներեն բառի վրա՝ հայերենը տեսնելու համար)․')}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-2.5 text-base font-semibold text-stone-900">
              ${EXAM_2.ex8FillBlanks.wordBank
                .map((w, i) => esCell(`wb_${i}`, w.es, w.hy))
                .join('')}
            </div>
          </div>

          <div class="space-y-3.5">
            ${EXAM_2.ex8FillBlanks.items
              .map((item) => {
                const val = state.answers[item.id] || '';
                const isRight = val === item.answer;
                const selCls = ex8Checked
                  ? isRight
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-rose-500 bg-rose-50 text-rose-950'
                  : 'border-stone-300 bg-white text-stone-900';
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-2">
                    <div class="flex flex-wrap items-center gap-2 text-base text-stone-900">
                      <span>${esc(item.before)}</span>
                      <select
                        data-select-input="${item.id}"
                        class="px-3 py-2 text-base font-medium border rounded-md focus:outline-none focus:border-orange-600 ${selCls}"
                      >
                        <option value="">— elegir —</option>
                        ${EXAM_2.ex8FillBlanks.wordBank
                          .map(
                            (w) =>
                              `<option value="${esc(w.es)}" ${val === w.es ? 'selected' : ''}>${esc(w.es)}</option>`
                          )
                          .join('')}
                      </select>
                      <span>${esc(item.after)}</span>
                      ${
                        ex8Checked
                          ? isRight
                            ? '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>'
                            : `<span class="text-sm font-semibold text-rose-800">✕ Correcto: ${esc(item.answer)}</span>`
                          : ''
                      }
                    </div>
                    <div class="text-sm text-stone-600">
                      ${esCell(`fb_tr_${item.id}`, item.fullEs, item.hy)}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button type="button" data-check-group="ex8_blanks" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar respuestas</button>
            <button type="button" data-reset-group="ex8_blanks" data-reset-keys="${EXAM_2.ex8FillBlanks.items.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg cursor-pointer">Reiniciar</button>
            ${ex8Checked ? `<span class="text-base font-bold font-mono-num text-stone-900">Resultado: ${ex8Score} / 6</span>` : ''}
          </div>
        </div>

        <!-- Ejercicio 9: Preguntas difíciles -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold text-stone-900">
            ${esCell('e2_ex9_t', 'Ejercicio 9. Responde con frases completas (Preguntas difíciles)', 'Վարժություն 9․ Պատասխանի՛ր ամբողջական նախադասություններով')}
          </h3>
          <div class="space-y-4">
            ${EXAM_2.ex9HardQuestions
              .map((q) => {
                const open = openAnswers.has(q.id);
                return `
                  <div class="p-5 border border-orange-200/80 rounded-lg space-y-3 bg-[#fffbf7]/40">
                    <div class="text-base font-semibold text-stone-900">${esBlock(`hq_q_${q.id}`, q.qEs, q.qHy)}</div>
                    <textarea
                      rows="2"
                      data-input-key="${q.id}"
                      placeholder="Escribe tu respuesta completa en español (Porque...)..."
                      class="w-full px-3.5 py-2.5 text-base bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-200"
                    >${esc(state.answers[q.id] || '')}</textarea>
                    <button type="button" data-toggle-ans="${q.id}" class="px-4 py-2 text-sm font-medium border border-stone-300 bg-white rounded-lg hover:bg-orange-50 cursor-pointer">
                      ${open ? 'Ocultar respuesta' : 'Ver respuesta correcta'}
                    </button>
                    ${
                      open
                        ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-base">
                             ${esBlock(`hq_a_${q.id}`, q.aEs, q.aHy)}
                           </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </section>

      <!-- Plantillas para memorizar -->
      <section class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-8 space-y-4">
        <div>
          <p class="text-sm text-stone-600">Expresiones clave para memorizar antes del examen</p>
          <h2 class="text-2xl font-bold text-stone-900 mt-0.5">
            ${esBlock('e2_tpl_h', 'Plantillas y frases clave para el examen', 'Պատրաստի կաղապարներ և առանցքային արտահայտություններ')}
          </h2>
        </div>
        <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
          <table class="w-full text-left text-base">
            <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
              <tr>
                <th class="px-4 py-3.5">Situación / Pregunta</th>
                <th class="px-4 py-3.5">Inicio en español</th>
                <th class="px-4 py-3.5 text-right">Audio</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-orange-100">
              ${EXAM_2.templates
                .map(
                  (t, i) => `
                <tr>
                  <td class="px-4 py-3.5 text-stone-700">${esCell(`tpl_ctx_${i}`, t.ctxEs, t.ctxHy)}</td>
                  <td class="px-4 py-3.5 font-semibold text-stone-900">${esCell(`tpl_${i}`, t.es, t.hy)}</td>
                  <td class="px-4 py-3.5 text-right">
                    <button type="button" data-speak="${esc(t.es)}" class="text-sm font-semibold text-orange-700 hover:underline cursor-pointer">Escuchar</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <div class="text-sm text-stone-700 leading-relaxed flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span class="font-semibold text-stone-800">Conectores clave:</span>
          ${esCell('conn_1', 'porque', 'որովհետև')}
          ${esCell('conn_2', 'al principio', 'սկզբում')}
          ${esCell('conn_3', 'después', 'հետո')}
          ${esCell('conn_4', 'finalmente', 'վերջապես')}
          ${esCell('conn_5', 'significa que', 'նշանակում է, որ')}
        </div>
      </section>
    </div>
  `;
}

// ============================================================================
// VIEW 3: TEORÍA COMPLETA DE 1.º ESO
// ============================================================================
function renderTheory() {
  const q = state.theorySearch.trim().toLowerCase();
  const filteredFiguras = THEORY.figuras.filter((f) => {
    const matchLevel = state.theoryLevelFilter === 'all' || f.level === state.theoryLevelFilter;
    const matchSearch =
      !q ||
      f.nameEs.toLowerCase().includes(q) ||
      f.defEs.toLowerCase().includes(q) ||
      f.exEs.toLowerCase().includes(q) ||
      f.hy.toLowerCase().includes(q);
    return matchLevel && matchSearch;
  });

  return `
    <div class="grid lg:grid-cols-[235px_1fr] gap-8 items-start">
      <!-- Sticky Section Index -->
      <aside class="hidden lg:block sticky top-24 space-y-1 text-[15px]">
        <p class="text-sm font-semibold text-stone-500 px-3 pb-2">Բովանդակություն</p>
        <a href="#th-generos" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">1. Գրական սեռեր</a>
        <a href="#th-formas" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">2. Գրականություն և ձևեր</a>
        <a href="#th-figuras" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">3. 14 միջոցները</a>
        <a href="#th-funciones" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">4. Գործառույթներ և տեսակներ</a>
        <a href="#th-comunicacion" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">5. Հաղորդակցում</a>
        <a href="#th-gramatica" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">6. Խոսքի մասեր</a>
        <a href="#th-plan" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">7. 3 պարապմունքի պլան</a>
      </aside>

      <div class="space-y-10 min-w-0">
        <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
          <p class="text-sm font-medium text-stone-600">1.º ESO · Դպրոցական տետրի ամբողջական տեսությունը</p>
          <h1 class="text-3xl md:text-4xl font-bold text-stone-900">
            ${esBlock('th_h1', 'Resumen de teoría — Lengua Castellana y Literatura', 'Տեսության ամփոփում — Իսպաներեն և գրականություն')}
          </h1>
          <p class="text-base text-stone-700">
            Սեղմի՛ր ցանկացած իսպաներեն տերմինի, սահմանման կամ օրինակի վրա՝ հայերեն թարգմանությունը բացելու համար։
          </p>
        </header>

        <!-- 1. Los grandes géneros literarios -->
        <section id="th-generos" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-4 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_g_h', '1. Los grandes géneros literarios', '1. Գրականության հիմնական սեռերը')}
          </h2>
          <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
            <table class="w-full text-left text-base">
              <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                <tr>
                  <th class="px-4 py-3.5">Género</th>
                  <th class="px-4 py-3.5">Explicación (haz clic para traducir)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-orange-100">
                ${THEORY.generos
                  .map(
                    (g, i) => `
                  <tr>
                    <td class="px-4 py-3.5 font-semibold text-stone-900 whitespace-nowrap">${esc(g.es)}</td>
                    <td class="px-4 py-3.5 text-stone-800">${esCell(`th_gen_${i}`, g.defEs, g.hy)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg text-base text-stone-800">
            ${esBlock('th_gen_note', THEORY.generosNoteEs, THEORY.generosNoteHy)}
          </div>
        </section>

        <!-- 2. Literatura, lenguaje y formas -->
        <section id="th-formas" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-4 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_f_h', '2. Literatura, lenguaje y formas', '2. Գրականություն, լեզու և ժանրային ձևեր')}
          </h2>
          <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
            <table class="w-full text-left text-base">
              <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                <tr>
                  <th class="px-4 py-3.5">Concepto</th>
                  <th class="px-4 py-3.5">Definición (haz clic para traducir)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-orange-100">
                ${THEORY.formas
                  .map(
                    (f, i) => `
                  <tr>
                    <td class="px-4 py-3.5 font-semibold text-stone-900 whitespace-nowrap">${esc(f.termEs)}</td>
                    <td class="px-4 py-3.5 text-stone-800">${esCell(`th_frm_${i}`, f.defEs, f.hy)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- 3. Las 14 figuras literarias -->
        <section id="th-figuras" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('th_fig_h', '3. Las 14 figuras literarias', '3. 14 գեղարվեստական միջոցները')}
            </h2>
            <input
              type="search"
              data-theory-search="1"
              value="${esc(state.theorySearch)}"
              placeholder="Buscar figura o ejemplo..."
              class="px-3.5 py-2 text-base border border-stone-300 rounded-lg bg-[#fffbf7] focus:bg-white focus:outline-none focus:border-orange-600 w-full sm:w-64"
            />
          </div>

          <div class="flex flex-wrap gap-1.5 p-1 bg-orange-50 border border-orange-200/70 rounded-lg w-fit">
            ${[
              { id: 'all', label: 'Todas (14)' },
              { id: 'Fónico', label: 'Fónico' },
              { id: 'Morfosintáctico', label: 'Morfosintáctico' },
              { id: 'Semántico', label: 'Semántico' },
            ]
              .map(
                (tab) => `
              <button
                type="button"
                data-theory-filter="${tab.id}"
                class="px-3.5 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  state.theoryLevelFilter === tab.id
                    ? 'bg-white text-orange-900 shadow-xs font-semibold'
                    : 'text-stone-700 hover:text-stone-900'
                }"
              >${tab.label}</button>
            `
              )
              .join('')}
          </div>

          <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
            <table class="w-full text-left text-base">
              <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                <tr>
                  <th class="px-4 py-3.5">Figura</th>
                  <th class="px-4 py-3.5">Nivel</th>
                  <th class="px-4 py-3.5">Ejemplo</th>
                  <th class="px-4 py-3.5">Explicación</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-orange-100">
                ${
                  filteredFiguras.length === 0
                    ? '<tr><td colspan="4" class="px-4 py-6 text-center text-stone-500">No se encontró ninguna figura con esa búsqueda.</td></tr>'
                    : filteredFiguras
                        .map(
                          (f, i) => `
                      <tr>
                        <td class="px-4 py-3.5 font-semibold text-stone-900 whitespace-nowrap">${esc(f.nameEs)}</td>
                        <td class="px-4 py-3.5 text-sm text-stone-600 whitespace-nowrap">${esc(f.level)}</td>
                        <td class="px-4 py-3.5 text-stone-900">${esCell(`th_fg_${f.nameEs}_${i}`, f.exEs, f.exHy)}</td>
                        <td class="px-4 py-3.5 text-stone-800">${esCell(`th_fg_def_${f.nameEs}_${i}`, f.defEs, f.hy)}</td>
                      </tr>
                    `
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>

          <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg text-sm text-stone-800">
            ${esBlock('th_epa_note', THEORY.epanadiplosisNoteEs, THEORY.epanadiplosisNoteHy)}
          </div>
        </section>

        <!-- 4. Funciones del lenguaje & Modalidades oracionales -->
        <section id="th-funciones" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_fm_h', '4. Funciones del lenguaje y modalidades oracionales', '4. Խոսքի գործառույթները և նախադասության տեսակները')}
          </h2>

          <div class="p-4 bg-orange-50 border border-orange-300 rounded-lg text-base text-orange-950 leading-relaxed">
            ${esBlock(
              'th_fm_diff',
              'Diferencia clave: la función del lenguaje indica para qué habla el emisor (su intención). La modalidad oracional indica cómo expresa su actitud (afirmación, pregunta, orden, deseo, duda…).',
              'Տարբերությունը․ Función del lenguaje — ինչո՞ւ / ի՞նչ նպատակով է մարդը խոսում։ Modalidad oracional — ինչպե՞ս է արտահայտվում նրա վերաբերմունքը (հաստատում, հարց, հրաման, ցանկություն, կասկած և այլն)։'
            )}
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-3">
              <h3 class="text-lg font-semibold text-stone-900">
                ${esCell('th_fn_sub', 'Funciones del lenguaje (6)', 'Խոսքի գործառույթները (6)')}
              </h3>
              <div class="border border-orange-200/80 rounded-lg divide-y divide-orange-100">
                ${THEORY.funciones
                  .map(
                    (f, i) => `
                  <div class="p-4 space-y-2">
                    <div class="font-semibold text-base text-stone-900">${esc(f.nameEs)}</div>
                    <div class="text-sm text-stone-700">${esCell(`th_fn_d_${i}`, f.descEs, f.descHy)}</div>
                    <div class="text-base text-stone-900 pt-0.5">${esCell(`th_fn_${i}`, f.exEs, f.exHy)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="space-y-3">
              <h3 class="text-lg font-semibold text-stone-900">
                ${esCell('th_md_sub', 'Modalidades oracionales (7)', 'Նախադասության տեսակները (7)')}
              </h3>
              <div class="border border-orange-200/80 rounded-lg divide-y divide-orange-100">
                ${THEORY.modalidades
                  .map(
                    (m, i) => `
                  <div class="p-4 space-y-2">
                    <div class="font-semibold text-base text-stone-900">${esc(m.nameEs)}</div>
                    <div class="text-sm text-stone-700">${esCell(`th_md_d_${i}`, m.descEs, m.descHy)}</div>
                    <div class="text-base text-stone-900 pt-0.5">${esCell(`th_md_${i}`, m.exEs, m.exHy)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </section>

        <!-- 5. Elementos de la comunicación (Warm Orange SVG diagram + clickable Spanish terms) -->
        <section id="th-comunicacion" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_com_h', '5. Los elementos de la comunicación', '5. Հաղորդակցման 6 տարրերը')}
          </h2>
          <div class="p-4 bg-orange-50/40 border border-orange-200/80 rounded-lg overflow-x-auto">
            <svg viewBox="0 0 760 220" class="w-full min-w-[560px] h-auto" role="img" aria-label="Esquema de los elementos de la comunicación">
              <rect x="8" y="8" width="744" height="204" rx="12" fill="#ffffff" stroke="#fdba74" stroke-dasharray="6 4" />
              <text x="380" y="34" text-anchor="middle" fill="#78716c" font-size="13" font-weight="600">CONTEXTO — Situación, lugar y momento</text>

              <rect x="30" y="70" width="164" height="86" rx="10" fill="#fff7ed" stroke="#c2410c" stroke-width="1.8" />
              <text x="112" y="106" text-anchor="middle" fill="#9a3412" font-size="15" font-weight="700">EMISOR</text>
              <text x="112" y="130" text-anchor="middle" fill="#44403c" font-size="12.5">Quien envía</text>

              <rect x="262" y="54" width="236" height="46" rx="8" fill="#fffbf7" stroke="#fb923c" />
              <text x="380" y="82" text-anchor="middle" fill="#1c1917" font-size="14" font-weight="600">MENSAJE · Información</text>

              <rect x="262" y="110" width="112" height="46" rx="8" fill="#fffbf7" stroke="#fed7aa" />
              <text x="318" y="130" text-anchor="middle" fill="#1c1917" font-size="13" font-weight="600">CÓDIGO</text>
              <text x="318" y="147" text-anchor="middle" fill="#57534e" font-size="12">Idioma / signos</text>

              <rect x="386" y="110" width="112" height="46" rx="8" fill="#fffbf7" stroke="#fed7aa" />
              <text x="442" y="130" text-anchor="middle" fill="#1c1917" font-size="13" font-weight="600">CANAL</text>
              <text x="442" y="147" text-anchor="middle" fill="#57534e" font-size="12">Medio físico</text>

              <rect x="566" y="70" width="164" height="86" rx="10" fill="#ecfdf5" stroke="#047857" stroke-width="1.8" />
              <text x="648" y="106" text-anchor="middle" fill="#065f46" font-size="15" font-weight="700">RECEPTOR</text>
              <text x="648" y="130" text-anchor="middle" fill="#44403c" font-size="12.5">Quien recibe</text>

              <line x1="196" y1="113" x2="254" y2="113" stroke="#c2410c" stroke-width="2" />
              <polygon points="254,108 262,113 254,118" fill="#c2410c" />
              <line x1="500" y1="113" x2="558" y2="113" stroke="#047857" stroke-width="2" />
              <polygon points="558,108 566,113 558,118" fill="#047857" />

              <text x="380" y="190" text-anchor="middle" fill="#57534e" font-size="12.5">Ejemplo: La profesora Elena → «Mañana visitaremos el museo» (español / pizarra) → Los alumnos</text>
            </svg>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            ${[
              { es: 'Emisor: quien envía el mensaje.', hy: 'Ուղարկող՝ ով ուղարկում է հաղորդագրությունը։' },
              { es: 'Receptor: quien recibe el mensaje.', hy: 'Ստացող՝ ով ստանում է հաղորդագրությունը։' },
              { es: 'Mensaje: información que se transmite.', hy: 'Հաղորդագրություն՝ փոխանցվող տեղեկությունը։' },
              { es: 'Código: lengua o sistema de signos.', hy: 'Կոդ՝ օգտագործվող լեզուն կամ նշանների համակարգը։' },
              { es: 'Canal: medio por el que viaja el mensaje.', hy: 'Ալիք՝ միջոցը, որով փոխանցվում է հաղորդագրությունը։' },
              { es: 'Contexto: situación, lugar y momento.', hy: 'Համատեքստ՝ իրավիճակը, վայրը և ժամանակը։' },
            ]
              .map(
                (el, idx) => `
              <div class="p-3 bg-orange-50/40 border border-orange-200/70 rounded-lg text-stone-800">
                ${esCell(`th_com_el_${idx}`, el.es, el.hy)}
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- 6. Las categorías gramaticales -->
        <section id="th-gramatica" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-4 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_gr_h', '6. Las categorías gramaticales (10)', '6. Խոսքի մասերը (10)')}
          </h2>
          <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
            <table class="w-full text-left text-base">
              <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                <tr>
                  <th class="px-4 py-3.5">Categoría</th>
                  <th class="px-4 py-3.5">Definición (haz clic para traducir)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-orange-100">
                ${THEORY.categorias
                  .map(
                    (c, i) => `
                  <tr>
                    <td class="px-4 py-3.5 font-semibold text-stone-900 whitespace-nowrap">${esc(c.nameEs)}</td>
                    <td class="px-4 py-3.5 text-stone-800">${esCell(`th_cat_${i}`, c.defEs, c.hy)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- 7. Study Plan -->
        <section id="th-plan" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-4 scroll-mt-24">
          <h2 class="text-2xl font-bold text-stone-900">
            ${esCell('th_plan_h', '7. Cómo preparar el examen en 3 sesiones', '7. Ինչպե՞ս պատրաստվել քննությանը 3 պարապմունքով')}
          </h2>
          <div class="grid md:grid-cols-3 gap-4">
            ${THEORY.studyPlan
              .map(
                (p, i) => `
              <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg space-y-2.5">
                <div class="text-sm font-bold text-orange-700">${esCell(`plan_s_${i}`, p.stepEs, p.stepHy)}</div>
                <div class="text-base font-semibold text-stone-900">${esCell(`plan_${i}`, p.titleEs, p.titleHy)}</div>
                <div class="text-sm leading-relaxed text-stone-700">${esCell(`plan_d_${i}`, p.descEs, p.descHy)}</div>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="text-base text-stone-700 pt-2 leading-relaxed">
            ${esBlock(
              'th_plan_tip',
              'Consejo clave de 1.º ESO: no basta con escribir el nombre del concepto (por ejemplo, «Es una metáfora»); completa siempre tu respuesta explicando el motivo con «porque…».',
              '1.º ESO-ի ամենակարևոր սովորությունը․ երեխան պետք է կարողանա ոչ միայն գրել անվանումը (օրինակ՝ «Es una metáfora»), այլև լրացնել այն «porque...» հիմնավորմամբ։'
            )}
          </div>
        </section>
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 4: GRAN SIMULACRO DE EXAMEN — 80 PUNTOS (PARTES 1–10)
// ============================================================================
function renderBigExam() {
  const p2Checked = !!state.checked['big_p2'];
  const p3Checked = !!state.checked['big_p3'];
  const p4MlcChecked = !!state.checked['big_p4_mlc'];
  const p5Checked = !!state.checked['big_p5'];
  const p6Checked = !!state.checked['big_p6'];
  const p6LvlChecked = !!state.checked['big_p6_lvl'];
  const p6MetChecked = !!state.checked['big_p6_met'];
  const p7Checked = !!state.checked['big_p7'];
  const p8Checked = !!state.checked['big_p8'];
  const p10Checked = !!state.checked['big_p10'];

  const activeVerse = BIG_EXAM.part4Romance.verses[state.activeRomanceVerse] || BIG_EXAM.part4Romance.verses[1];

  const p6Score = BIG_EXAM.part6Figuras.items.reduce((a, i) => a + (state.answers[i.id] === i.answer ? 1 : 0), 0);
  const p7Score = BIG_EXAM.part7Funciones.items.reduce((a, i) => a + (state.answers[i.id] === i.answer ? 1 : 0), 0);
  const p8Score = BIG_EXAM.part8Modalidades.items.reduce((a, i) => a + (state.answers[i.id] === i.answer ? 1 : 0), 0);
  const p10Score = BIG_EXAM.part10Gramatica.words.reduce((a, w) => a + (state.answers[w.id] === w.answer ? 1 : 0), 0);

  const partNav = [
    { id: 'be-p1', label: '1. Կարդալ (12)' },
    { id: 'be-p2', label: '2. Սեռեր (6)' },
    { id: 'be-p3', label: '3. Culta/Pop. (6)' },
    { id: 'be-p4', label: '4. Ռոմանս (6)' },
    { id: 'be-p5', label: '5. Արձակ/Չափ. (5)' },
    { id: 'be-p6', label: '6. 14 միջոց (14)' },
    { id: 'be-p7', label: '7. Գործառույթ (6)' },
    { id: 'be-p8', label: '8. Տեսակներ (7)' },
    { id: 'be-p9', label: '9. Հաղորդակց. (6)' },
    { id: 'be-p10', label: '10. Քերական. (12)' },
  ];

  return `
    <div class="grid lg:grid-cols-[225px_1fr] gap-8 items-start">
      <aside class="hidden lg:block sticky top-24 space-y-1 text-sm font-medium">
        <p class="font-semibold text-stone-500 px-3 pb-2">80 միավոր · 10 բաժին</p>
        ${partNav
          .map(
            (n) =>
              `<a href="#${n.id}" class="block px-3 py-2 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md font-mono-num">${n.label}</a>`
          )
          .join('')}
      </aside>

      <div class="space-y-10 min-w-0">
        <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
          <div class="text-sm font-medium text-stone-600">${esCell('be_meta', BIG_EXAM.metaEs, BIG_EXAM.metaHy)}</div>
          <h1 class="text-3xl md:text-4xl font-bold text-stone-900">
            ${esBlock('be_h1', BIG_EXAM.titleEs, BIG_EXAM.titleHy)}
          </h1>
          <p class="text-base text-stone-700">
            Ամբողջական քննություն՝ ընդգրկելով դպրոցական տետրի բոլոր 10 թեմաները։ Սեղմի՛ր իսպաներենի վրա՝ հայերեն թարգմանությունը տեսնելու համար։
          </p>
        </header>

        <!-- PARTE 1 -->
        <section id="be-p1" class="space-y-6 scroll-mt-24">
          ${renderStory(
            'bigexam',
            { ...BIG_EXAM.part1, noteEs: 'Texto original creado para esta prueba.', noteHy: 'Բնօրինակ տեքստ՝ ստեղծված այս քննության համար։' },
            'Parte 1 · 12 puntos',
            'Մաս 1 · 12 միավոր'
          )}
          ${renderQuestionsAF('bigexam_p1', BIG_EXAM.part1.questionsAF)}
        </section>

        <!-- PARTE 2 -->
        <section id="be-p2" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p2_pts', 'Parte 2 · 6 puntos', 'Մաս 2 · 6 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p2_h', 'PARTE 2. Los géneros literarios', 'ՄԱՍ 2․ Գրական սեռերը')}</h2>
          </div>
          <div class="space-y-4">
            ${BIG_EXAM.part2Generos
              .map((item, i) => {
                const chosen = state.answers[item.id];
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-3 bg-[#fffbf7]/40">
                    <div class="text-base font-medium text-stone-900">
                      <span class="font-mono-num font-bold text-orange-700 mr-1.5">${i + 1}.</span>
                      ${esBlock(`bp2_${item.id}`, item.es, item.hy)}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      ${['Narrativo', 'Lírico', 'Dramático']
                        .map((g) => {
                          const isSel = chosen === g;
                          const isCor = g === item.correct;
                          let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                          let mark = '';
                          if (p2Checked) {
                            if (isCor) {
                              cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                              mark = '✓ ';
                            } else if (isSel) {
                              cls = 'bg-rose-50 border-rose-500 text-rose-950';
                              mark = '✕ ';
                            }
                          } else if (isSel) {
                            cls = 'bg-orange-700 border-orange-700 text-white';
                          }
                          return `<button type="button" data-select-ans="${item.id}" data-select-val="${g}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${g}</button>`;
                        })
                        .join('')}
                    </div>
                    ${p2Checked ? `<div class="pt-2.5 border-t border-orange-100 text-sm">${esBlock(`bp2_j_${item.id}`, item.justEs, item.justHy)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex gap-2.5">
            <button type="button" data-check-group="big_p2" class="px-5 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar y ver justificación</button>
            <button type="button" data-reset-group="big_p2" data-reset-keys="${BIG_EXAM.part2Generos.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
          </div>
        </section>

        <!-- PARTE 3 -->
        <section id="be-p3" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p3_pts', 'Parte 3 · 6 puntos', 'Մաս 3 · 6 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p3_h', 'PARTE 3. Literatura culta y popular', 'ՄԱՍ 3․ Հեղինակային և ժողովրդական գրականություն')}</h2>
          </div>
          <div class="space-y-3">
            ${BIG_EXAM.part3CultaPopular
              .map((item) => {
                const chosen = state.answers[item.id];
                return `
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-orange-200/80 rounded-lg bg-[#fffbf7]/40">
                    <div class="text-base text-stone-900">${esCell(`bp3_${item.id}`, item.es, item.hy)}</div>
                    <div class="flex gap-2 shrink-0">
                      ${['Culta', 'Popular']
                        .map((opt) => {
                          const isSel = chosen === opt;
                          const isCor = opt === item.correct;
                          let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                          let mark = '';
                          if (p3Checked) {
                            if (isCor) {
                              cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                              mark = '✓ ';
                            } else if (isSel) {
                              cls = 'bg-rose-50 border-rose-500 text-rose-950';
                              mark = '✕ ';
                            }
                          } else if (isSel) {
                            cls = 'bg-orange-700 border-orange-700 text-white';
                          }
                          return `<button type="button" data-select-ans="${item.id}" data-select-val="${opt}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${opt}</button>`;
                        })
                        .join('')}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex gap-2.5">
            <button type="button" data-check-group="big_p3" class="px-5 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
            <button type="button" data-reset-group="big_p3" data-reset-keys="${BIG_EXAM.part3CultaPopular.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
          </div>
          <div class="grid md:grid-cols-2 gap-3.5 pt-2">
            <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg text-sm">
              <div class="font-semibold text-stone-900 mb-1.5">${esCell('bp3_mc_h', 'Modelo de justificación — Culta:', 'Օրինակ հիմնավորում — Culta․')}</div>
              ${esBlock('bp3_mc', BIG_EXAM.part3Models.cultaEs, BIG_EXAM.part3Models.cultaHy)}
            </div>
            <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg text-sm">
              <div class="font-semibold text-stone-900 mb-1.5">${esCell('bp3_mp_h', 'Modelo de justificación — Popular:', 'Օրինակ հիմնավորում — Popular․')}</div>
              ${esBlock('bp3_mp', BIG_EXAM.part3Models.popularEs, BIG_EXAM.part3Models.popularHy)}
            </div>
          </div>
        </section>

        <!-- PARTE 4: Romance + Interactive Syllable Counter + Mito/Leyenda/Cuento -->
        <section id="be-p4" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p4_pts', 'Parte 4 · 6 puntos', 'Մաս 4 · 6 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p4_h', 'PARTE 4. El romance, el mito, la leyenda y el cuento', 'ՄԱՍ 4․ Ռոմանս, առասպել, ավանդազրույց և պատմվածք')}</h2>
          </div>

          <div class="grid md:grid-cols-2 gap-6 items-start">
            <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg space-y-2.5">
              <div class="text-sm font-medium text-stone-600 mb-2">
                ${esBlock(
                  'bp4_hint',
                  'Haz clic en cualquier verso para ver su división en 8 sílabas. Pulsa el verso a la derecha para ver la traducción al armenio.',
                  'Սեղմի՛ր ցանկացած տողի վրա՝ 8 վանկերի բաժանումը տեսնելու համար։ Աջ կողմում սեղմի՛ր տողի վրա՝ հայերեն թարգմանությունը բացելու համար։'
                )}
              </div>
              ${BIG_EXAM.part4Romance.verses
                .map((v, idx) => {
                  const active = state.activeRomanceVerse === idx;
                  return `
                    <button
                      type="button"
                      data-romance-verse="${idx}"
                      class="w-full text-left px-4 py-3 text-base rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-white border-orange-600 shadow-xs text-stone-900 font-semibold'
                          : 'bg-transparent border-transparent hover:bg-white hover:border-orange-200 text-stone-800'
                      }"
                    >
                      <span><span class="font-mono-num text-sm text-stone-400 mr-2">${v.num}</span>${esc(v.es)}</span>
                      <span class="font-mono-num text-sm ${v.rhyme ? 'text-orange-700 font-bold' : 'text-stone-400'}">${v.rhyme ? '8a' : '8–'}</span>
                    </button>
                  `;
                })
                .join('')}
            </div>

            <div class="p-5 border border-orange-200/80 rounded-lg space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-bold text-orange-700 font-mono-num">Verso ${activeVerse.num} · 8 sílabas (Octosílabo)</span>
                <span class="text-sm text-stone-600">${activeVerse.rhyme ? `Rima: ${activeVerse.rhymeWord}` : 'Verso impar · suelto'}</span>
              </div>
              <div class="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                ${activeVerse.syllables
                  .map(
                    (syl, idx) => `
                  <div class="text-center p-2.5 rounded-md border ${
                    activeVerse.rhyme && idx >= 6 ? 'bg-orange-100 border-orange-400 text-orange-950' : 'bg-orange-50/50 border-orange-200/80 text-stone-900'
                  }">
                    <div class="text-base font-semibold">${esc(syl)}</div>
                    <div class="font-mono-num text-xs text-stone-500">${idx + 1}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
              <div class="p-3.5 bg-orange-50/60 border border-orange-200 rounded-lg text-base text-stone-900 font-medium">
                ${esBlock(`rom_v_${activeVerse.num}`, activeVerse.es, activeVerse.hy)}
              </div>
              <div class="text-sm text-stone-700">
                ${esBlock(
                  'rom_rhyme_note',
                  'Plaza / casa → a partir de la última vocal acentuada coinciden las vocales a–a: rima asonante.',
                  'Plaza / casa → վերջին շեշտված ձայնավորից սկսած համընկնում են a–a ձայնավորները՝ rima asonante։'
                )}
              </div>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-3.5">
            ${BIG_EXAM.part4Romance.questions
              .map((q) => {
                const k = `rom_q_${q.letter}`;
                const open = openAnswers.has(k);
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-2.5">
                    <div class="text-base font-semibold text-stone-900">
                      <span class="font-mono-num text-orange-700 mr-1">${q.letter})</span>
                      ${esCell(`rom_qt_${q.letter}`, q.qEs, q.qHy)}
                    </div>
                    <button type="button" data-toggle-ans="${k}" class="text-sm font-semibold text-orange-700 hover:underline cursor-pointer">
                      ${open ? 'Ocultar respuesta' : 'Ver respuesta'}
                    </button>
                    ${open ? `<div class="text-sm pt-2.5 border-t border-orange-100 text-stone-800">${esBlock(`rom_qa_${q.letter}`, q.aEs, q.aHy)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="pt-4 border-t border-orange-100 space-y-4">
            <h3 class="text-lg font-semibold text-stone-900">${esCell('mlc_h', 'Ejercicio 2. ¿Mito, leyenda o cuento?', 'Վարժություն 2․ Առասպե՞լ, ավանդազրո՞ւյց, թե՞ պատմվածք')}</h3>
            <div class="space-y-3">
              ${BIG_EXAM.part4Romance.mitoLeyendaCuento
                .map((item) => {
                  const chosen = state.answers[item.id];
                  return `
                    <div class="p-4 border border-orange-200/80 rounded-lg space-y-3 bg-[#fffbf7]/40">
                      <div class="text-base text-stone-900">${esBlock(`mlc_${item.id}`, item.es, item.hy)}</div>
                      <div class="flex flex-wrap gap-2">
                        ${['Mito', 'Leyenda', 'Cuento']
                          .map((opt) => {
                            const isSel = chosen === opt;
                            const isCor = opt === item.correct;
                            let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                            let mark = '';
                            if (p4MlcChecked) {
                              if (isCor) {
                                cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                                mark = '✓ ';
                              } else if (isSel) {
                                cls = 'bg-rose-50 border-rose-500 text-rose-950';
                                mark = '✕ ';
                              }
                            } else if (isSel) {
                              cls = 'bg-orange-700 border-orange-700 text-white';
                            }
                            return `<button type="button" data-select-ans="${item.id}" data-select-val="${opt}" class="px-3.5 py-2 text-sm font-medium border rounded-lg cursor-pointer ${cls}">${mark}${opt}</button>`;
                          })
                          .join('')}
                      </div>
                      ${p4MlcChecked ? `<div class="text-sm pt-2.5 border-t border-orange-100">${esBlock(`mlc_j_${item.id}`, item.justEs, item.justHy)}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
            <div class="flex gap-2.5">
              <button type="button" data-check-group="big_p4_mlc" class="px-5 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
              <button type="button" data-reset-group="big_p4_mlc" data-reset-keys="mlc1,mlc2,mlc3" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
            </div>
          </div>
        </section>

        <!-- PARTE 5 -->
        <section id="be-p5" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p5_pts', 'Parte 5 · 5 puntos', 'Մաս 5 · 5 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p5_h', 'PARTE 5. Lenguaje literario, verso y prosa', 'ՄԱՍ 5․ Գեղարվեստական լեզու, չափածո և արձակ')}</h2>
          </div>

          <div class="p-4 border border-orange-200/80 rounded-lg space-y-3.5 bg-[#fffbf7]/40">
            <div class="text-base font-semibold text-stone-900">${esBlock('bp5_q1', BIG_EXAM.part5Lenguaje.ex1.qEs, BIG_EXAM.part5Lenguaje.ex1.qHy)}</div>
            <div class="space-y-2.5">
              ${BIG_EXAM.part5Lenguaje.ex1.options
                .map((opt, idx) => {
                  const isSel = state.answers['bp5_ex1'] === idx;
                  const isCor = idx === BIG_EXAM.part5Lenguaje.ex1.correct;
                  let cls = 'border-stone-200 bg-white hover:bg-orange-50/50';
                  let mark = '';
                  if (p5Checked) {
                    if (isCor) {
                      cls = 'border-emerald-600 bg-emerald-50';
                      mark = '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>';
                    } else if (isSel) {
                      cls = 'border-rose-500 bg-rose-50';
                      mark = '<span class="text-sm font-semibold text-rose-800">✕ Incorrecto</span>';
                    }
                  } else if (isSel) {
                    cls = 'border-orange-600 bg-orange-50';
                  }
                  const trId = `bp5_o_${idx}`;
                  const open = openTranslations.has(trId);
                  return `
                    <div class="border rounded-lg ${cls}">
                      <div class="flex items-center justify-between gap-2 px-4 py-3">
                        <div class="flex items-center gap-3 flex-1">
                          <button
                            type="button"
                            data-select-ans="bp5_ex1"
                            data-select-val="${idx}"
                            aria-label="Elegir opción ${opt.letter}"
                            class="w-8 h-8 rounded-lg border font-mono-num text-sm font-bold flex items-center justify-center shrink-0 cursor-pointer ${
                              isSel
                                ? 'bg-orange-700 border-orange-700 text-white'
                                : 'bg-white border-stone-300 text-orange-800 hover:border-orange-600'
                            }"
                          >${opt.letter}</button>
                          <span
                            role="button"
                            tabindex="0"
                            data-tr-toggle="${trId}"
                            title="Haz clic para ver la traducción al armenio"
                            class="es-click text-base text-stone-900 ${open ? 'is-open' : ''}"
                          >${esc(opt.es)}</span>
                        </div>
                        ${mark ? `<div class="shrink-0">${mark}</div>` : ''}
                      </div>
                      <div data-tr-target="${trId}" class="hy-inline px-4 pb-3 pl-15 ${open ? 'is-visible' : ''}">${esc(opt.hy)}</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
            <button type="button" data-check-group="big_p5" class="px-5 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
            ${p5Checked ? `<div class="text-sm pt-2">${esBlock('bp5_exp1', BIG_EXAM.part5Lenguaje.ex1.expEs, BIG_EXAM.part5Lenguaje.ex1.expHy)}</div>` : ''}
          </div>

          <div class="grid md:grid-cols-2 gap-3.5">
            ${BIG_EXAM.part5Lenguaje.openQuestions
              .map((q) => {
                const k = `bp5_oq_${q.num}`;
                const open = openAnswers.has(k);
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-2.5">
                    <div class="text-base font-semibold text-stone-900">
                      <span class="font-mono-num text-orange-700 mr-1">${q.num}.</span>
                      ${esCell(`bp5_oqt_${q.num}`, q.qEs, q.qHy)}
                    </div>
                    <button type="button" data-toggle-ans="${k}" class="text-sm font-semibold text-orange-700 hover:underline cursor-pointer">
                      ${open ? 'Ocultar respuesta' : 'Ver respuesta'}
                    </button>
                    ${open ? `<div class="text-sm pt-2.5 border-t border-orange-100">${esBlock(`bp5_oqa_${q.num}`, q.aEs, q.aHy)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- PARTE 6: 14 Figuras + Niveles + 3 Formas de Metáfora -->
        <section id="be-p6" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p6_pts', 'Parte 6 · 14 puntos', 'Մաս 6 · 14 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p6_h', 'PARTE 6. Figuras literarias (14 figuras)', 'ՄԱՍ 6․ Բոլոր 14 գեղարվեստական միջոցները')}</h2>
          </div>

          <div class="space-y-3">
            ${BIG_EXAM.part6Figuras.items
              .map((item) => {
                const val = state.answers[item.id] || '';
                const isCor = val === item.answer;
                const selCls = p6Checked
                  ? isCor
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-rose-500 bg-rose-50 text-rose-950'
                  : 'border-stone-300 bg-white';
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-2 bg-[#fffbf7]/30">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div class="text-base font-medium text-stone-900">${esCell(`bf_s_${item.id}`, item.es, item.hy)}</div>
                      <div class="flex items-center gap-2 shrink-0">
                        <select data-select-input="${item.id}" class="px-3 py-2 text-sm font-medium border rounded-lg ${selCls}">
                          <option value="">— elegir figura —</option>
                          ${BIG_EXAM.part6Figuras.allChoices
                            .map((c) => `<option value="${esc(c)}" ${val === c ? 'selected' : ''}>${esc(c)}</option>`)
                            .join('')}
                        </select>
                        ${p6Checked ? (isCor ? '<span class="text-sm font-bold text-emerald-700">✓</span>' : `<span class="text-sm font-semibold text-rose-800">${esc(item.answer)}</span>`) : ''}
                      </div>
                    </div>
                    ${p6Checked ? `<div class="text-sm pt-2 border-t border-orange-100 text-stone-800">${esBlock(`bf_e_${item.id}`, item.expEs, item.expHy)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" data-check-group="big_p6" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar las 14</button>
            <button type="button" data-reset-group="big_p6" data-reset-keys="${BIG_EXAM.part6Figuras.items.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-base font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
            ${p6Checked ? `<span class="text-base font-bold font-mono-num">Resultado: ${p6Score} / 14</span>` : ''}
          </div>

          <!-- Niveles classifier -->
          <div class="pt-5 border-t border-orange-100 space-y-3.5">
            <h3 class="text-lg font-semibold text-stone-900">${esCell('be_p6_lvl_h', 'Ejercicio adicional. Clasifica las figuras por niveles', 'Լրացուցիչ․ Դասակարգի՛ր ըստ մակարդակների (Fónico / Morfosintáctico / Semántico)')}</h3>
            <div class="grid sm:grid-cols-2 gap-3">
              ${BIG_EXAM.part6Figuras.levelsQuiz
                .map((row) => {
                  const key = `lvl_${row.figura}`;
                  const val = state.answers[key] || '';
                  const ok = val === row.level;
                  return `
                    <div class="flex items-center justify-between gap-2 p-3.5 border border-orange-200/80 rounded-lg text-sm">
                      <span class="font-semibold text-stone-900">${esc(row.figura)}</span>
                      <div class="flex items-center gap-1.5">
                        <select data-select-input="${key}" class="px-2.5 py-1.5 border rounded-md ${
                          p6LvlChecked ? (ok ? 'border-emerald-600 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-stone-300 bg-white'
                        }">
                          <option value="">— nivel —</option>
                          <option value="Fónico" ${val === 'Fónico' ? 'selected' : ''}>Fónico</option>
                          <option value="Morfosintáctico" ${val === 'Morfosintáctico' ? 'selected' : ''}>Morfosintáctico</option>
                          <option value="Semántico" ${val === 'Semántico' ? 'selected' : ''}>Semántico</option>
                        </select>
                        ${p6LvlChecked && !ok ? `<span class="text-rose-800 font-semibold text-xs">${esc(row.level)}</span>` : ''}
                        ${p6LvlChecked && ok ? '<span class="text-emerald-700 font-bold">✓</span>' : ''}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
            <div class="flex gap-2.5">
              <button type="button" data-check-group="big_p6_lvl" class="px-4 py-2 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar niveles</button>
              <button type="button" data-reset-group="big_p6_lvl" data-reset-keys="${BIG_EXAM.part6Figuras.levelsQuiz.map((r) => `lvl_${r.figura}`).join(',')}" class="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
            </div>
          </div>

          <!-- 3 formas de metáfora -->
          <div class="pt-5 border-t border-orange-100 space-y-3.5">
            <h3 class="text-lg font-semibold text-stone-900">${esCell('be_p6_met_h', 'Ejercicio adicional. Las tres formas de metáfora (A es B · B de A · B)', 'Լրացուցիչ․ Փոխաբերության 3 կառուցվածքները')}</h3>
            <div class="grid md:grid-cols-3 gap-3.5">
              ${BIG_EXAM.part6Figuras.metaforaForms
                .map((m) => {
                  const chosen = state.answers[m.id];
                  return `
                    <div class="p-4 border border-orange-200/80 rounded-lg space-y-3">
                      <div class="text-base font-medium text-stone-900">${esCell(`mf_${m.id}`, m.es, m.hy)}</div>
                      <div class="flex gap-2">
                        ${['A es B', 'B de A', 'B']
                          .map((opt) => {
                            const isSel = chosen === opt;
                            const isCor = opt === m.correct;
                            let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50';
                            if (p6MetChecked) {
                              if (isCor) cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                              else if (isSel) cls = 'bg-rose-50 border-rose-500 text-rose-950';
                            } else if (isSel) {
                              cls = 'bg-orange-700 border-orange-700 text-white';
                            }
                            return `<button type="button" data-select-ans="${m.id}" data-select-val="${opt}" class="px-3 py-1.5 text-sm font-mono-num border rounded-md cursor-pointer ${cls}">${opt}</button>`;
                          })
                          .join('')}
                      </div>
                      ${p6MetChecked ? `<div class="text-sm text-stone-700">${esBlock(`mf_e_${m.id}`, m.expEs, m.expHy)}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
            <button type="button" data-check-group="big_p6_met" class="px-4 py-2 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
          </div>
        </section>

        <!-- PARTE 7 & PARTE 8 -->
        <section class="grid lg:grid-cols-2 gap-6">
          <div id="be-p7" class="bg-white border border-orange-200/80 rounded-xl p-6 space-y-4 scroll-mt-24">
            <div>
              <div class="text-sm text-stone-600">${esCell('be_p7_pts', 'Parte 7 · 6 puntos', 'Մաս 7 · 6 միավոր')}</div>
              <h2 class="text-xl font-bold text-stone-900 mt-0.5">${esCell('be_p7_h', 'PARTE 7. Funciones del lenguaje', 'ՄԱՍ 7․ Խոսքի գործառույթները')}</h2>
            </div>
            <div class="space-y-3">
              ${BIG_EXAM.part7Funciones.items
                .map((item) => {
                  const val = state.answers[item.id] || '';
                  const ok = val === item.answer;
                  return `
                    <div class="p-4 border border-orange-200/80 rounded-lg space-y-2.5 bg-[#fffbf7]/40">
                      <div class="text-base font-medium text-stone-900">${esCell(`fn_q_${item.id}`, item.es, item.hy)}</div>
                      <div class="flex items-center gap-2">
                        <select data-select-input="${item.id}" class="px-3 py-2 text-sm border rounded-lg ${
                          p7Checked ? (ok ? 'border-emerald-600 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-stone-300 bg-white'
                        }">
                          <option value="">— elegir —</option>
                          ${BIG_EXAM.part7Funciones.choices.map((c) => `<option value="${c}" ${val === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        ${p7Checked ? (ok ? '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>' : `<span class="text-sm font-semibold text-rose-800">${item.answer}</span>`) : ''}
                      </div>
                      ${p7Checked ? `<div class="text-sm text-stone-700">${esBlock(`fn_e_${item.id}`, item.expEs, item.expHy)}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
            <div class="flex items-center gap-3">
              <button type="button" data-check-group="big_p7" class="px-4 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
              <button type="button" data-reset-group="big_p7" data-reset-keys="${BIG_EXAM.part7Funciones.items.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
              ${p7Checked ? `<span class="text-sm font-bold font-mono-num">${p7Score} / 6</span>` : ''}
            </div>
          </div>

          <div id="be-p8" class="bg-white border border-orange-200/80 rounded-xl p-6 space-y-4 scroll-mt-24">
            <div>
              <div class="text-sm text-stone-600">${esCell('be_p8_pts', 'Parte 8 · 7 puntos', 'Մաս 8 · 7 միավոր')}</div>
              <h2 class="text-xl font-bold text-stone-900 mt-0.5">${esCell('be_p8_h', 'PARTE 8. Modalidades oracionales', 'ՄԱՍ 8․ Նախադասության տեսակները')}</h2>
            </div>
            <div class="space-y-3">
              ${BIG_EXAM.part8Modalidades.items
                .map((item) => {
                  const val = state.answers[item.id] || '';
                  const ok = val === item.answer;
                  return `
                    <div class="p-4 border border-orange-200/80 rounded-lg space-y-2.5 bg-[#fffbf7]/40">
                      <div class="text-base font-medium text-stone-900">${esCell(`md_q_${item.id}`, item.es, item.hy)}</div>
                      <div class="flex items-center gap-2">
                        <select data-select-input="${item.id}" class="px-3 py-2 text-sm border rounded-lg ${
                          p8Checked ? (ok ? 'border-emerald-600 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-stone-300 bg-white'
                        }">
                          <option value="">— elegir —</option>
                          ${BIG_EXAM.part8Modalidades.choices.map((c) => `<option value="${c}" ${val === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        ${p8Checked ? (ok ? '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>' : `<span class="text-sm font-semibold text-rose-800">${item.answer}</span>`) : ''}
                      </div>
                      ${p8Checked ? `<div class="text-sm text-stone-700">${esBlock(`md_e_${item.id}`, item.expEs, item.expHy)}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
            <div class="flex items-center gap-3">
              <button type="button" data-check-group="big_p8" class="px-4 py-2.5 text-sm font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar</button>
              <button type="button" data-reset-group="big_p8" data-reset-keys="${BIG_EXAM.part8Modalidades.items.map((i) => i.id).join(',')}" class="px-4 py-2.5 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
              ${p8Checked ? `<span class="text-sm font-bold font-mono-num">${p8Score} / 7</span>` : ''}
            </div>
          </div>
        </section>

        <!-- PARTE 9: Comunicación -->
        <section id="be-p9" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p9_pts', 'Parte 9 · 6 puntos', 'Մաս 9 · 6 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p9_h', 'PARTE 9. Los elementos de la comunicación', 'ՄԱՍ 9․ Հաղորդակցման տարրերը')}</h2>
          </div>
          <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg">
            ${renderClickableSentences('be_p9_sit', BIG_EXAM.part9Comunicacion.sentences)}
          </div>
          <div class="grid md:grid-cols-2 gap-3.5">
            ${BIG_EXAM.part9Comunicacion.items
              .map((item) => {
                const k = `com_${item.letter}`;
                const open = openAnswers.has(k);
                return `
                  <div class="p-4 border border-orange-200/80 rounded-lg space-y-2.5">
                    <div class="text-base font-semibold text-stone-900">
                      <span class="font-mono-num text-orange-700 mr-1">${item.letter})</span>
                      ${esCell(`com_q_${item.letter}`, item.qEs, item.qHy)}
                    </div>
                    <input
                      type="text"
                      data-input-key="${k}"
                      value="${esc(state.answers[k] || '')}"
                      placeholder="Escribe tu respuesta..."
                      class="w-full px-3.5 py-2 text-base bg-[#fffbf7] border border-stone-300 rounded-md focus:bg-white focus:outline-none focus:border-orange-600"
                    />
                    <button type="button" data-toggle-ans="${k}" class="text-sm font-semibold text-orange-700 hover:underline cursor-pointer">
                      ${open ? 'Ocultar respuesta' : 'Ver respuesta correcta'}
                    </button>
                    ${open ? `<div class="text-sm pt-2.5 border-t border-orange-100">${esBlock(`com_a_${item.letter}`, item.aEs, item.aHy)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- PARTE 10: Categorías gramaticales interactive sentence analyzer -->
        <section id="be-p10" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
          <div>
            <div class="text-sm text-stone-600">${esCell('be_p10_pts', 'Parte 10 · 12 puntos', 'Մաս 10 · 12 միավոր')}</div>
            <h2 class="text-2xl font-bold text-stone-900 mt-0.5">${esCell('be_p10_h', 'PARTE 10. Las categorías gramaticales', 'ՄԱՍ 10․ Խոսքի մասերի վերլուծություն')}</h2>
          </div>

          <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-lg space-y-3.5">
            <div class="text-sm text-stone-600">
              ${esCell(
                'be_p10_hint',
                'Oración (haz clic en la oración completa o en cada palabra para ver su traducción):',
                'Նախադասությունը (սեղմի՛ր ամբողջ նախադասության կամ առանձին բառի վրա՝ թարգմանությունը տեսնելու համար)․'
              )}
            </div>
            <div class="text-lg font-semibold text-stone-900">
              ${esBlock('be_p10_sent', BIG_EXAM.part10Gramatica.sentenceEs, BIG_EXAM.part10Gramatica.sentenceHy)}
            </div>
            <div class="flex flex-wrap gap-2 pt-2">
              ${BIG_EXAM.part10Gramatica.words
                .map((w) => {
                  const active = state.activeGrammarWord === w.id;
                  const val = state.answers[w.id] || '';
                  const ok = val === w.answer;
                  let cls = 'bg-white border-stone-300 text-stone-900 hover:border-orange-500';
                  if (p10Checked) {
                    cls = ok ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-rose-50 border-rose-500 text-rose-950';
                  } else if (active) {
                    cls = 'bg-orange-700 border-orange-700 text-white';
                  } else if (val) {
                    cls = 'bg-orange-100 border-orange-400 text-orange-950';
                  }
                  return `<button type="button" data-gram-word="${w.id}" class="px-3.5 py-2 text-base font-medium border rounded-lg cursor-pointer transition-colors ${cls}">${esc(w.word)}</button>`;
                })
                .join('')}
            </div>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${BIG_EXAM.part10Gramatica.words
              .map((w, idx) => {
                const val = state.answers[w.id] || '';
                const ok = val === w.answer;
                const isActive = state.activeGrammarWord === w.id;
                return `
                  <div class="p-4 rounded-lg border transition-colors space-y-2.5 ${
                    isActive ? 'border-orange-600 bg-orange-50/50' : 'border-orange-200/80 bg-white'
                  }">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-base font-semibold text-stone-900">
                        <span class="font-mono-num text-sm text-stone-400 mr-1">${idx + 1}.</span>
                        ${esCell(`gw_${w.id}`, w.word, w.hy)}
                      </span>
                      ${p10Checked ? (ok ? '<span class="text-sm font-bold text-emerald-700">✓</span>' : '<span class="text-sm font-bold text-rose-700">✕</span>') : ''}
                    </div>
                    <select data-select-input="${w.id}" class="w-full px-3 py-2 text-sm border rounded-md ${
                      p10Checked ? (ok ? 'border-emerald-600 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-stone-300 bg-white'
                    }">
                      <option value="">— categoría —</option>
                      ${BIG_EXAM.part10Gramatica.choices.map((c) => `<option value="${esc(c)}" ${val === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                    </select>
                    ${p10Checked ? `<div class="text-sm text-stone-700">${esCell(`gw_ans_${w.id}`, `Correcto: ${w.answer}`, `Ճիշտը՝ ${w.catHy}`)}</div>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button type="button" data-check-group="big_p10" class="px-5 py-2.5 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg cursor-pointer">Comprobar las 12 palabras</button>
            <button type="button" data-reset-group="big_p10" data-reset-keys="${BIG_EXAM.part10Gramatica.words.map((w) => w.id).join(',')}" class="px-4 py-2.5 text-base font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer">Reiniciar</button>
            ${p10Checked ? `<span class="text-base font-bold font-mono-num">Resultado: ${p10Score} / 12</span>` : ''}
          </div>

          <div class="pt-4 border-t border-orange-100 space-y-3">
            <h3 class="text-base font-semibold text-stone-900">
              ${esCell('be_p10_hc_h', 'Explicación de los casos más difíciles', 'Ամենադժվար դեպքերի բացատրությունը')}
            </h3>
            <div class="grid sm:grid-cols-2 gap-3.5">
              ${BIG_EXAM.part10Gramatica.hardCases
                .map(
                  (hc, i) => `
                <div class="p-4 bg-orange-50/50 border border-orange-200/80 rounded-lg space-y-1.5 text-sm">
                  <p class="font-semibold text-stone-900 text-base">${esc(hc.word)}</p>
                  <div>${esBlock(`hc_${i}`, hc.es, hc.hy)}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 5: MINI EXAMEN FINAL — 10 PREGUNTAS DE REPASO
// ============================================================================
function renderMiniExam() {
  const checked = !!state.checked['mini_exam'];
  const answeredCount = MINI_EXAM.reduce((a, q) => a + (state.answers[q.id] !== undefined ? 1 : 0), 0);
  const score = MINI_EXAM.reduce((a, q) => a + (state.answers[q.id] === q.correct ? 1 : 0), 0);

  const feedbackEs =
    score >= 9
      ? '¡Excelente resultado! Estás preparado para el examen de 1.º ESO.'
      : score >= 6
      ? 'Buen resultado. Revisa las explicaciones de las preguntas falladas y vuelve a intentarlo.'
      : 'Conviene repasar la sección de «Teoría» y volver a hacer el test.';

  const feedbackHy =
    score >= 9
      ? 'Հիանալի արդյունք․ պատրաստ ես 1.º ESO քննությանը։'
      : score >= 6
      ? 'Լավ արդյունք է․ նայի՛ր սխալված հարցերի բացատրությունները և կրկնի՛ր։'
      : 'Արժե կրկնել «Տեսություն» բաժինը և նորից փորձել թեստը։';

  return `
    <div class="space-y-8 max-w-4xl mx-auto">
      <header class="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-orange-200/80">
        <div class="space-y-2">
          <p class="text-sm font-medium text-stone-600">Ամփոփիչ ստուգում · Բոլոր թեմաներից</p>
          <h1 class="text-3xl md:text-4xl font-bold text-stone-900">
            ${esBlock('me_h1', 'Mini examen final — 10 preguntas de repaso', 'Ամփոփիչ փոքր քննություն — 10 կրկնության հարց')}
          </h1>
          <p class="text-base text-stone-700">
            Ստուգի՛ր գիտելիքներդ բոլոր թեմաներից․ սեղմի՛ր ցանկացած իսպաներեն հարցի կամ տարբերակի վրա՝ հայերեն թարգմանությունը տեսնելու համար։
          </p>
        </div>
        <div class="text-right font-mono-num">
          <div class="text-base font-semibold text-stone-900">${answeredCount} / 10 respondidas</div>
          ${checked ? `<div class="text-base font-bold text-orange-700 mt-0.5">Nota: ${score} / 10</div>` : ''}
        </div>
      </header>

      ${
        checked
          ? `<div class="p-5 rounded-xl border ${
              score >= 8 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-orange-50 border-orange-300 text-orange-950'
            } flex flex-wrap items-center justify-between gap-4">
               <div>
                 <p class="text-lg font-bold font-mono-num">Tu resultado: ${score} / 10</p>
                 <div class="text-base mt-1">${esCell('me_fb', feedbackEs, feedbackHy)}</div>
               </div>
               <button type="button" data-reset-group="mini_exam" data-reset-keys="${MINI_EXAM.map((q) => q.id).join(',')}" class="px-4 py-2.5 text-sm font-medium bg-white border border-stone-300 text-stone-800 rounded-lg hover:bg-orange-50 cursor-pointer">Repetir test</button>
             </div>`
          : ''
      }

      <div class="space-y-5">
        ${MINI_EXAM.map((q) => {
          const chosen = state.answers[q.id];
          return `
            <div class="bg-white border border-orange-200/80 rounded-xl p-6 space-y-4">
              <div class="text-[17px] font-semibold text-stone-900 leading-snug">
                ${esBlock(`me_q_${q.id}`, q.qEs, q.qHy)}
              </div>
              <div class="grid sm:grid-cols-2 gap-3">
                ${q.options
                  .map((opt, idx) => {
                    const isSel = chosen === idx;
                    const isCor = idx === q.correct;
                    let cls = 'border-stone-200 bg-white hover:bg-orange-50/60';
                    let status = '';
                    if (checked) {
                      if (isCor) {
                        cls = 'border-emerald-600 bg-emerald-50';
                        status = '<span class="text-sm font-semibold text-emerald-800">✓ Correcto</span>';
                      } else if (isSel) {
                        cls = 'border-rose-500 bg-rose-50';
                        status = '<span class="text-sm font-semibold text-rose-800">✕ Incorrecto</span>';
                      }
                    } else if (isSel) {
                      cls = 'border-orange-600 bg-orange-50';
                    }
                    const trId = `me_o_${q.id}_${idx}`;
                    const open = openTranslations.has(trId);
                    return `
                      <div class="border rounded-lg transition-colors ${cls}">
                        <div class="flex items-center justify-between gap-2 px-4 py-3">
                          <div class="flex items-center gap-3 flex-1">
                            <button
                              type="button"
                              data-select-ans="${q.id}"
                              data-select-val="${idx}"
                              aria-label="Elegir opción ${opt.letter}"
                              class="w-8 h-8 rounded-lg border font-mono-num text-sm font-bold flex items-center justify-center shrink-0 cursor-pointer ${
                                isSel
                                  ? 'bg-orange-700 border-orange-700 text-white'
                                  : 'bg-white border-stone-300 text-orange-800 hover:border-orange-600'
                              }"
                            >${opt.letter}</button>
                            <span
                              role="button"
                              tabindex="0"
                              data-tr-toggle="${trId}"
                              title="Haz clic para ver la traducción al armenio"
                              class="es-click text-base text-stone-900 ${open ? 'is-open' : ''}"
                            >${esc(opt.es)}</span>
                          </div>
                          ${status ? `<div class="shrink-0">${status}</div>` : ''}
                        </div>
                        <div data-tr-target="${trId}" class="hy-inline px-4 pb-3 pl-15 ${open ? 'is-visible' : ''}">${esc(opt.hy)}</div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
              ${
                checked
                  ? `<div class="pt-3.5 border-t border-orange-100 text-sm text-stone-800">
                       ${esBlock(`me_exp_${q.id}`, q.expEs, q.expHy)}
                     </div>`
                  : ''
              }
            </div>
          `;
        }).join('')}
      </div>

      <div class="flex flex-wrap items-center gap-3 pt-2">
        <button type="button" data-check-group="mini_exam" class="px-6 py-3 text-base font-medium text-white bg-orange-700 hover:bg-orange-800 rounded-lg transition-colors cursor-pointer">Comprobar examen</button>
        <button type="button" data-reset-group="mini_exam" data-reset-keys="${MINI_EXAM.map((q) => q.id).join(',')}" class="px-5 py-3 text-base font-medium text-stone-700 bg-white border border-stone-300 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer">Reiniciar</button>
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 6: RESUMEN DE TEORÍA — CÓMO HACER UN RESUMEN & TIEMPOS VERBALES
// ============================================================================
function renderResumenGuide() {
  const g1 = RESUMEN_GUIDE.guide1;
  const g2 = RESUMEN_GUIDE.guide2;

  const quickCorrect = g2.quickCheck.reduce((acc, q) => acc + (state.answers[q.id] === q.correct ? 1 : 0), 0);
  const luciaFull = g1.ejemplo.originalSentences.map((s) => s.es).join(' ');
  const claraFull = g2.ejemploClara.originalSentences.map((s) => s.es).join(' ');

  return `
    <div class="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
      <!-- Sticky Armenian Navigation Sidebar -->
      <aside class="hidden lg:block sticky top-24 space-y-4 text-[14.5px]">
        <div class="space-y-1">
          <p class="text-xs font-bold uppercase tracking-wider text-orange-700 px-3 pb-1">Մաս I · Ամփոփում</p>
          <a href="#rg1-que" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">1. Ի՞նչ է ամփոփումը</a>
          <a href="#rg1-pasos" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">2. 5 քայլերը</a>
          <a href="#rg1-partes" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">3. Երեք մասերը</a>
          <a href="#rg1-palabras" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">4. Օգտակար բառեր</a>
          <a href="#rg1-ejemplo" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">5. Օրինակ (Lucía)</a>
          <a href="#rg1-errores" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">6. Հաճախակի սխալներ</a>
          <a href="#rg1-truco" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">7. Հուշում քննության համար</a>
        </div>
        <div class="space-y-1 pt-3 border-t border-orange-200/80">
          <p class="text-xs font-bold uppercase tracking-wider text-orange-700 px-3 pb-1">Մաս II · Բայի ժամանակներ</p>
          <a href="#rg2-tiempo" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">1. Ո՞ր ժամանակով գրել</a>
          <a href="#rg2-pasado" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">2. Անցյալ ժամանակները</a>
          <a href="#rg2-pasos" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">3. Քայլ առ քայլ ընտրություն</a>
          <a href="#rg2-ejemplo" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">4. Ամբողջական օրինակ (Clara)</a>
          <a href="#rg2-check" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">5. Արագ ստուգում (3 հարց)</a>
          <a href="#rg2-regla" class="block px-3 py-1.5 text-stone-700 hover:text-orange-800 hover:bg-orange-50 rounded-md">6. Գլխավոր կանոնը</a>
        </div>
      </aside>

      <div class="space-y-12 min-w-0">
        <!-- ================================================================ -->
        <!-- GUIDE 1: CÓMO HACER UN RESUMEN DE UN TEXTO                       -->
        <!-- ================================================================ -->
        <div class="space-y-8">
          <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
            <div class="text-sm font-medium text-stone-600">${esCell('rg1_meta', g1.metaEs, g1.metaHy)}</div>
            <h1 class="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight leading-tight">
              ${esBlock('rg1_h1', g1.titleEs, g1.titleHy)}
            </h1>
            <p class="text-base text-stone-700 max-w-3xl leading-relaxed">${esc(g1.subHy)}</p>
          </header>

          <!-- 1. ¿Qué es un resumen? -->
          <section id="rg1-que" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s1_h', '1. ¿Qué es un resumen?', '1. Ի՞նչ է ամփոփումը')}
            </h2>
            <div class="p-4 bg-orange-50/70 border border-orange-200 rounded-lg text-lg text-stone-900 leading-relaxed">
              ${esBlock('rg1_def', g1.definition.es, g1.definition.hy)}
            </div>
            <div class="space-y-3">
              <h3 class="text-base font-bold text-orange-800">
                ${esCell('rg1_imp_h', 'Importante', 'Կարևոր')}
              </h3>
              <ul class="space-y-2.5">
                ${g1.importante
                  .map(
                    (item, i) => `
                  <li class="flex items-start gap-2.5 p-3 bg-[#fffbf7] border border-orange-200/70 rounded-lg text-base text-stone-900">
                    <span class="text-orange-700 font-bold mt-0.5">•</span>
                    <div class="flex-1">${esBlock(`rg1_imp_${i}`, item.es, item.hy)}</div>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          </section>

          <!-- 2. Pasos para hacer un buen resumen -->
          <section id="rg1-pasos" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s2_h', '2. Pasos para hacer un buen resumen', '2. Ամփոփում գրելու քայլերը')}
            </h2>
            <div class="space-y-3.5">
              ${g1.pasos
                .map(
                  (p) => `
                <div class="p-4 md:p-5 border border-orange-200/80 rounded-xl bg-[#fffbf7]/60 space-y-2.5">
                  <div class="flex items-start gap-3">
                    <span class="w-8 h-8 rounded-lg bg-orange-700 text-white font-mono-num text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">${p.num}</span>
                    <div class="space-y-1.5 flex-1">
                      <div class="text-lg font-bold text-stone-900">${esCell(`rg1_p_t_${p.num}`, p.titleEs, p.titleHy)}</div>
                      <div class="text-base text-stone-800">${esBlock(`rg1_p_d_${p.num}`, p.descEs, p.descHy)}</div>
                      <div class="pt-1.5 text-sm font-semibold text-orange-800">
                        ${esCell(`rg1_p_q_${p.num}`, p.qEs, p.qHy)}
                      </div>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <!-- 3. Las tres partes de un resumen -->
          <section id="rg1-partes" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s3_h', '3. Las tres partes de un resumen', '3. Ամփոփման երեք մասերը')}
            </h2>
            <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
              <table class="w-full text-left text-base">
                <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                  <tr>
                    <th class="px-4 py-3.5">Parte</th>
                    <th class="px-4 py-3.5">Qué escribir</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-orange-100">
                  ${g1.partes
                    .map(
                      (row, i) => `
                    <tr>
                      <td class="px-4 py-3.5 font-bold text-stone-900 whitespace-nowrap">${esCell(`rg1_pt_n_${i}`, row.partEs, row.partHy)}</td>
                      <td class="px-4 py-3.5 text-stone-800">${esCell(`rg1_pt_w_${i}`, row.whatEs, row.whatHy)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            <div class="p-4 bg-orange-50/60 border border-orange-200/80 rounded-lg text-base text-stone-800">
              ${esBlock('rg1_partes_note', g1.partesNote.es, g1.partesNote.hy)}
            </div>
          </section>

          <!-- 4. Palabras útiles -->
          <section id="rg1-palabras" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s4_h', '4. Palabras útiles para escribir un resumen', '4. Օգտակար բառեր ամփոփում գրելու համար')}
            </h2>
            <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              ${g1.palabrasUtiles
                .map(
                  (w, i) => `
                <div class="p-3.5 bg-[#fffbf7] border border-orange-200/80 rounded-lg text-base font-semibold text-stone-900">
                  ${esCell(`rg1_w_${i}`, w.es, w.hy)}
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <!-- 5. Ejemplo de un resumen (Lucía) -->
          <section id="rg1-ejemplo" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-2xl font-bold text-stone-900">
                ${esCell('rg1_s5_h', '5. Ejemplo de un resumen', '5. Ամփոփման օրինակ')}
              </h2>
              <button
                type="button"
                data-speak="${esc(luciaFull)}"
                class="px-3.5 py-2 text-sm font-medium text-orange-900 bg-orange-50 border border-orange-300 rounded-lg hover:bg-orange-100 cursor-pointer"
              >Escuchar texto (ES)</button>
            </div>

            <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-3">
              <div class="text-sm font-bold uppercase tracking-wide text-orange-800">
                ${esCell('rg1_ex_orig_h', 'Texto original', 'Բնօրինակ տեքստ')}
              </div>
              <div class="text-[19px] leading-relaxed">
                ${renderClickableSentences('rg1_lucia', g1.ejemplo.originalSentences)}
              </div>
            </div>

            <div class="space-y-3">
              <h3 class="text-lg font-bold text-stone-900">
                ${esCell('rg1_antes_h', 'Antes de escribir', 'Գրելուց առաջ')}
              </h3>
              <div class="grid md:grid-cols-2 gap-3.5">
                ${g1.ejemplo.antesDeEscribir
                  .map(
                    (qa) => `
                  <div class="p-4 border border-orange-200/80 rounded-lg bg-[#fffbf7]/60 space-y-1.5">
                    <div class="text-base font-bold text-stone-900">${esCell(`rg1_qa_q_${qa.num}`, qa.qEs, qa.qHy)}</div>
                    <div class="text-base text-orange-900 font-medium">${esCell(`rg1_qa_a_${qa.num}`, qa.aEs, qa.aHy)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="p-5 bg-emerald-50/60 border border-emerald-300 rounded-xl space-y-3">
              <div class="text-sm font-bold uppercase tracking-wide text-emerald-800">
                ${esCell('rg1_corr_h', 'Resumen correcto', 'Ճիշտ ամփոփում')}
              </div>
              <div class="text-lg leading-relaxed">
                ${renderClickableSentences('rg1_lucia_res', g1.ejemplo.resumenCorrecto)}
              </div>
            </div>
          </section>

          <!-- 6. Errores frecuentes -->
          <section id="rg1-errores" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s6_h', '6. Errores frecuentes', '6. Հաճախակի սխալներ')}
            </h2>
            <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
              <table class="w-full text-left text-base">
                <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold">
                  <tr>
                    <th class="px-4 py-3.5 text-rose-800">✕ Incorrecto</th>
                    <th class="px-4 py-3.5 text-emerald-800">✓ Correcto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-orange-100">
                  ${g1.errores
                    .map(
                      (err, i) => `
                    <tr>
                      <td class="px-4 py-3.5 bg-rose-50/30 text-stone-900">${esCell(`rg1_err_w_${i}`, err.wrongEs, err.wrongHy)}</td>
                      <td class="px-4 py-3.5 bg-emerald-50/30 text-stone-900 font-medium">${esCell(`rg1_err_r_${i}`, err.rightEs, err.rightHy)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <!-- 7. Truco para el examen -->
          <section id="rg1-truco" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
            <h2 class="text-2xl font-bold text-stone-900">
              ${esCell('rg1_s7_h', '7. Truco para el examen', '7. Հուշում քննության համար')}
            </h2>
            <div class="text-base text-stone-800">
              ${esBlock('rg1_truco_intro', g1.truco.introEs, g1.truco.introHy)}
            </div>

            <div class="space-y-3">
              <div class="text-xs font-bold uppercase tracking-wider text-orange-800">
                ${esCell('rg1_5q_h', 'LAS 5 PREGUNTAS CLAVE', '5 ԱՌԱՆՑՔԱՅԻՆ ՀԱՐՑԵՐԸ')}
              </div>
              <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                ${g1.truco.preguntasClave
                  .map(
                    (pq) => `
                  <div class="p-4 border border-orange-200/80 rounded-xl bg-orange-50/40 space-y-2">
                    <span class="w-7 h-7 rounded-md bg-orange-700 text-white font-mono-num text-sm font-bold inline-flex items-center justify-center">${pq.num}</span>
                    <div class="text-lg font-bold text-stone-900">${esCell(`rg1_5q_q_${pq.num}`, pq.qEs, pq.qHy)}</div>
                    <div class="text-sm text-stone-700">${esCell(`rg1_5q_d_${pq.num}`, pq.dEs, pq.dHy)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="text-base text-stone-800">
              ${esBlock('rg1_join_note', g1.truco.joinNoteEs, g1.truco.joinNoteHy)}
            </div>

            <div class="p-5 bg-orange-100/70 border border-orange-300 rounded-xl space-y-3">
              <div class="text-sm font-bold uppercase tracking-wide text-orange-900">
                ${esCell('rg1_gold_h', 'Regla de oro', 'Ոսկե կանոն')}
              </div>
              <div class="text-lg font-semibold text-stone-900 italic">
                ${esBlock('rg1_gold', g1.truco.reglaDeOroEs, g1.truco.reglaDeOroHy)}
              </div>
              <div class="text-sm text-stone-800 pt-2 border-t border-orange-300/70">
                ${esBlock('rg1_len_note', g1.truco.lengthNoteEs, g1.truco.lengthNoteHy)}
              </div>
            </div>
          </section>
        </div>

        <!-- ================================================================ -->
        <!-- GUIDE 2: ¿QUÉ TIEMPOS VERBALES DEBEMOS UTILIZAR?                 -->
        <!-- ================================================================ -->
        <div class="space-y-8 pt-6 border-t-2 border-orange-300/80">
          <header class="space-y-2.5 pb-6 border-b border-orange-200/80">
            <div class="text-sm font-medium text-stone-600">${esCell('rg2_meta', g2.metaEs, g2.metaHy)}</div>
            <h2 class="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight leading-tight">
              ${esBlock('rg2_h1', g2.titleEs, g2.titleHy)}
            </h2>
            <p class="text-base text-stone-700 max-w-3xl leading-relaxed">${esc(g2.subHy)}</p>
          </header>

          <!-- 1. ¿En qué tiempo se escribe un resumen? -->
          <section id="rg2-tiempo" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h3 class="text-2xl font-bold text-stone-900">
              ${esCell('rg2_s1_h', '1. ¿En qué tiempo se escribe un resumen?', '1. Ո՞ր ժամանակով է գրվում ամփոփումը')}
            </h3>
            <div class="p-4 bg-orange-50/70 border border-orange-200 rounded-lg text-lg text-stone-900 leading-relaxed">
              ${esBlock('rg2_pres_rule', g2.presenteRule.es, g2.presenteRule.hy)}
            </div>

            <div class="grid md:grid-cols-2 gap-4">
              <div class="p-4 border border-orange-200/80 rounded-xl bg-[#fffbf7] space-y-2">
                <div class="text-xs font-bold uppercase tracking-wider text-stone-500">
                  ${esCell('rg2_orig_lbl', 'TEXTO ORIGINAL', 'ԲՆՕՐԻՆԱԿ')}
                </div>
                <div class="text-base font-medium text-stone-900">
                  ${esBlock('rg2_maria_orig', g2.mariaExample.origEs, g2.mariaExample.origHy)}
                </div>
              </div>
              <div class="p-4 border border-emerald-300 rounded-xl bg-emerald-50/50 space-y-2">
                <div class="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  ${esCell('rg2_res_lbl', 'RESUMEN (EN PRESENTE)', 'ԱՄՓՈՓՈՒՄ (ՆԵՐԿԱ ԺԱՄԱՆԱԿՈՎ)')}
                </div>
                <div class="text-base font-semibold text-stone-900">
                  ${esBlock('rg2_maria_res', g2.mariaExample.resEs, g2.mariaExample.resHy)}
                </div>
              </div>
            </div>

            <div class="p-4 bg-amber-50 border border-amber-300 rounded-lg text-base text-stone-900">
              ${esBlock('rg2_atencion', g2.atencion.es, g2.atencion.hy)}
            </div>
          </section>

          <!-- 2. Los tiempos del pasado -->
          <section id="rg2-pasado" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h3 class="text-2xl font-bold text-stone-900">
              ${esCell('rg2_s2_h', '2. Los tiempos del pasado', '2. Անցյալ ժամանակների ընտրությունը')}
            </h3>
            <div class="text-base text-stone-800">
              ${esBlock('rg2_pas_intro', g2.tiemposPasadoIntro.es, g2.tiemposPasadoIntro.hy)}
            </div>
            <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
              <table class="w-full text-left text-base">
                <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                  <tr>
                    <th class="px-4 py-3.5">Tiempo</th>
                    <th class="px-4 py-3.5">¿Cuándo se utiliza?</th>
                    <th class="px-4 py-3.5">Ejemplo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-orange-100">
                  ${g2.tiemposPasado
                    .map(
                      (t, i) => `
                    <tr>
                      <td class="px-4 py-3.5 font-bold text-orange-900 whitespace-nowrap">${esc(t.name)}</td>
                      <td class="px-4 py-3.5 text-stone-800">${esCell(`rg2_tp_w_${i}`, t.whenEs, t.whenHy)}</td>
                      <td class="px-4 py-3.5 text-stone-900 font-medium">${esCell(`rg2_tp_e_${i}`, t.exEs, t.exHy)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <!-- 3. Paso a paso -->
          <section id="rg2-pasos" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <h3 class="text-2xl font-bold text-stone-900">
              ${esCell('rg2_s3_h', '3. Paso a paso — Cómo elegir el tiempo correcto', '3. Քայլ առ քայլ — Ինչպես ընտրել ճիշտ ժամանակը')}
            </h3>
            <div class="space-y-4">
              ${g2.pasoAPaso
                .map(
                  (step) => `
                <div class="p-5 border border-orange-200/80 rounded-xl bg-[#fffbf7]/60 space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <span class="w-8 h-8 rounded-lg bg-orange-700 text-white font-mono-num text-sm font-bold flex items-center justify-center shrink-0">${step.num}</span>
                      <div class="text-lg font-bold text-stone-900">${esCell(`rg2_ps_q_${step.num}`, step.qEs, step.qHy)}</div>
                    </div>
                    <span class="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-orange-100 text-orange-900 border border-orange-300 rounded-md">${esc(step.tense)}</span>
                  </div>
                  <div class="text-base text-stone-800">${esBlock(`rg2_ps_d_${step.num}`, step.descEs, step.descHy)}</div>
                  <ul class="space-y-2 pt-1">
                    ${step.examples
                      .map(
                        (ex, idx) => `
                      <li class="flex items-start gap-2 text-base text-stone-900">
                        <span class="text-orange-700 font-bold">•</span>
                        <div class="flex-1">${esCell(`rg2_ps_ex_${step.num}_${idx}`, ex.es, ex.hy)}</div>
                      </li>
                    `
                      )
                      .join('')}
                  </ul>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <!-- 4. Ejemplo completo (Clara) -->
          <section id="rg2-ejemplo" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-6 scroll-mt-24">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-2xl font-bold text-stone-900">
                ${esCell('rg2_s4_h', '4. Ejemplo completo', '4. Ամբողջական օրինակ')}
              </h3>
              <button
                type="button"
                data-speak="${esc(claraFull)}"
                class="px-3.5 py-2 text-sm font-medium text-orange-900 bg-orange-50 border border-orange-300 rounded-lg hover:bg-orange-100 cursor-pointer"
              >Escuchar texto (ES)</button>
            </div>

            <div class="p-5 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-3">
              <div class="text-sm font-bold uppercase tracking-wide text-orange-800">
                ${esCell('rg2_clara_h', 'Texto original', 'Բնօրինակ')}
              </div>
              <div class="text-[19px] leading-relaxed">
                ${renderClickableSentences('rg2_clara', g2.ejemploClara.originalSentences)}
              </div>
            </div>

            <!-- Paso 1 -->
            <div class="space-y-3">
              <h4 class="text-lg font-bold text-stone-900">
                ${esCell('rg2_c_p1_h', 'Paso 1. Encontrar las ideas principales', 'Քայլ 1․ Գտնել գլխավոր մտքերը')}
              </h4>
              <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
                <table class="w-full text-left text-base">
                  <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                    <tr>
                      <th class="px-4 py-3">Pregunta</th>
                      <th class="px-4 py-3">Respuesta</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-orange-100">
                    ${g2.ejemploClara.paso1
                      .map(
                        (r, i) => `
                      <tr>
                        <td class="px-4 py-3 font-semibold text-stone-900">${esCell(`rg2_c1_q_${i}`, r.qEs, r.qHy)}</td>
                        <td class="px-4 py-3 text-stone-800">${esCell(`rg2_c1_a_${i}`, r.aEs, r.aHy)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Paso 2 -->
            <div class="space-y-3">
              <h4 class="text-lg font-bold text-stone-900">
                ${esCell('rg2_c_p2_h', 'Paso 2. Elegir los tiempos verbales', 'Քայլ 2․ Ընտրել բայի ժամանակները')}
              </h4>
              <div class="overflow-x-auto border border-orange-200/80 rounded-lg">
                <table class="w-full text-left text-base">
                  <thead class="bg-orange-50/80 border-b border-orange-200/80 text-sm font-semibold text-stone-700">
                    <tr>
                      <th class="px-4 py-3">Información</th>
                      <th class="px-4 py-3">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-orange-100">
                    ${g2.ejemploClara.paso2
                      .map(
                        (r, i) => `
                      <tr>
                        <td class="px-4 py-3 text-stone-900">${esCell(`rg2_c2_i_${i}`, r.infoEs, r.infoHy)}</td>
                        <td class="px-4 py-3 font-semibold text-orange-900">${esCell(`rg2_c2_t_${i}`, r.tenseEs, r.tenseHy)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Paso 3 -->
            <div class="space-y-3">
              <h4 class="text-lg font-bold text-stone-900">
                ${esCell('rg2_c_p3_h', 'Paso 3. Escribir el resumen', 'Քայլ 3․ Գրել ամփոփումը')}
              </h4>
              <div class="grid md:grid-cols-2 gap-4">
                <div class="p-5 bg-emerald-50/50 border border-emerald-300 rounded-xl space-y-3">
                  <div class="text-sm font-bold text-emerald-900">
                    ${esCell('rg2_optA_h', 'Opción A — Resumen en presente (opción más habitual)', 'Տարբերակ A — Ամփոփում ներկա ժամանակով (առավել տարածված տարբերակ)')}
                  </div>
                  <div class="text-base leading-relaxed">
                    ${renderClickableSentences('rg2_optA', g2.ejemploClara.opcionA)}
                  </div>
                </div>
                <div class="p-5 bg-orange-50/50 border border-orange-300 rounded-xl space-y-3">
                  <div class="text-sm font-bold text-orange-900">
                    ${esCell('rg2_optB_h', 'Opción B — Resumen en pasado', 'Տարբերակ B — Ամփոփում անցյալ ժամանակով')}
                  </div>
                  <div class="text-base leading-relaxed">
                    ${renderClickableSentences('rg2_optB', g2.ejemploClara.opcionB)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 5. Cómo decidir rápidamente (Interactive Quick Check 0 / 3) -->
          <section id="rg2-check" class="bg-white border border-orange-200/80 rounded-xl p-6 md:p-7 space-y-5 scroll-mt-24">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold uppercase tracking-wider text-orange-700">
                  ${esCell('rg2_qc_sub', 'COMPROBACIÓN', 'ՍՏՈՒԳՈՒՄ')}
                </div>
                <h3 class="text-2xl font-bold text-stone-900 mt-0.5">
                  ${esCell('rg2_s5_h', '5. Cómo decidir rápidamente', '5. Ինչպես արագ կողմնորոշվել')}
                </h3>
              </div>
              <div class="flex items-center gap-3">
                <span class="px-3.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200 font-mono-num text-base font-bold text-orange-900">
                  ${quickCorrect} / 3 correctas
                </span>
                <button
                  type="button"
                  data-reset-group="rg2_qc"
                  data-reset-keys="${g2.quickCheck.map((q) => q.id).join(',')}"
                  class="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-orange-50 cursor-pointer"
                >Repetir</button>
              </div>
            </div>

            <div class="space-y-4">
              ${g2.quickCheck
                .map((q) => {
                  const chosen = state.answers[q.id];
                  const answered = chosen !== undefined;
                  return `
                    <div class="p-5 border border-orange-200/80 rounded-xl bg-[#fffbf7]/50 space-y-3.5">
                      <div class="text-lg font-bold text-stone-900">
                        ${esBlock(`rg2_qc_q_${q.id}`, q.qEs, q.qHy)}
                      </div>
                      <div class="flex flex-wrap gap-2.5">
                        ${q.options
                          .map((opt) => {
                            const isSel = chosen === opt;
                            const isCor = opt === q.correct;
                            let cls = 'bg-white border-stone-300 text-stone-800 hover:bg-orange-50 hover:border-orange-400';
                            let mark = '';
                            if (answered) {
                              if (isCor) {
                                cls = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold';
                                mark = '✓ ';
                              } else if (isSel) {
                                cls = 'bg-rose-50 border-rose-500 text-rose-950';
                                mark = '✕ ';
                              }
                            }
                            return `<button type="button" data-select-ans="${q.id}" data-select-val="${opt}" class="px-4 py-2.5 text-base font-medium border rounded-lg transition-colors cursor-pointer ${cls}">${mark}${opt}</button>`;
                          })
                          .join('')}
                      </div>
                      ${
                        answered
                          ? `<div class="pt-2.5 border-t border-orange-100 text-sm text-stone-800">
                               ${esBlock(`rg2_qc_e_${q.id}`, q.expEs, q.expHy)}
                             </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>
          </section>

          <!-- 6. Regla principal para el examen -->
          <section id="rg2-regla" class="bg-orange-50/70 border border-orange-300 rounded-xl p-6 md:p-7 space-y-4 scroll-mt-24">
            <h3 class="text-2xl font-bold text-stone-900">
              ${esCell('rg2_s6_h', '6. Regla principal para el examen', '6. Գլխավոր կանոնը քննության համար')}
            </h3>
            <div class="text-lg font-medium text-stone-900 leading-relaxed">
              ${esBlock('rg2_reg_main', g2.reglaPrincipal.es, g2.reglaPrincipal.hy)}
            </div>
            <div class="pt-3 border-t border-orange-300/70 text-base text-stone-800 leading-relaxed">
              ${esBlock('rg2_reg_extra', g2.reglaPrincipal.extraEs, g2.reglaPrincipal.extraHy)}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// MAIN SHELL RENDERER (Strict 3-Zone Top Bar Contract)
// ============================================================================
function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  let contentHtml = '';
  if (state.activeTab === 'exam1') contentHtml = renderExam1();
  else if (state.activeTab === 'exam2') contentHtml = renderExam2();
  else if (state.activeTab === 'theory') contentHtml = renderTheory();
  else if (state.activeTab === 'resumen') contentHtml = renderResumenGuide();
  else if (state.activeTab === 'bigexam') contentHtml = renderBigExam();
  else contentHtml = renderMiniExam();

  root.innerHTML = `
    <div class="min-h-screen flex flex-col">
      <!-- Top Bar Contract: Zone 1 (Brand) — Zone 2 (concise nav links in Armenian) — Zone 3 (1 primary CTA) -->
      <header class="sticky top-0 z-30 bg-[#fffbf7]/95 backdrop-blur-sm border-b border-orange-200/90">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <a href="#top" data-nav-tab="exam1" class="font-display text-xl font-bold tracking-tight text-orange-950 whitespace-nowrap shrink-0">
            Lengua 1.º ESO
          </a>

          <nav class="hidden md:flex items-center gap-5 text-[15px] font-medium text-stone-700" aria-label="Հիմնական բաժիններ">
            ${NAV_TABS.map(
              (t) => `
              <button
                type="button"
                data-nav-tab="${t.id}"
                title="${esc(t.labelEs)}"
                class="py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                  state.activeTab === t.id
                    ? 'text-orange-700 border-orange-700 font-semibold'
                    : 'border-transparent hover:text-stone-900 hover:border-orange-300'
                }"
              >${esc(t.labelHy)}</button>
            `
            ).join('')}
          </nav>

          <div class="shrink-0">
            <button
              type="button"
              data-close-all-hy="1"
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-orange-700 text-white hover:bg-orange-800"
            >Փակել թարգմանությունները</button>
          </div>
        </div>

        <!-- Mobile section bar -->
        <nav class="md:hidden border-t border-orange-100 px-3 py-2.5 flex items-center gap-4 overflow-x-auto text-sm font-medium text-stone-700" aria-label="Բաժիններ">
          ${NAV_TABS.map(
            (t) => `
            <button
              type="button"
              data-nav-tab="${t.id}"
              title="${esc(t.labelEs)}"
              class="whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
                state.activeTab === t.id ? 'text-orange-700 border-orange-700 font-semibold' : 'border-transparent'
              }"
            >${esc(t.labelHy)}</button>
          `
          ).join('')}
        </nav>
      </header>

      <!-- Workspace -->
      <main id="top" class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 md:py-10">
        ${contentHtml}
      </main>

      <footer class="border-t border-orange-200/80 bg-white mt-12">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-sm text-stone-600">
          <span>Lengua Castellana y Literatura — 1.º ESO · Իսպաներեն–Հայերեն քննական ուղեցույց</span>
          <button type="button" data-reset-all="1" class="text-stone-700 hover:text-orange-800 hover:underline cursor-pointer">Մաքրել պահպանված առաջընթացը</button>
        </div>
      </footer>
    </div>
  `;
}

// ============================================================================
// EVENT DELEGATION (Fast, Zero-Flicker Click-to-Translate & Quiz Interactions)
// ============================================================================
function toggleTranslationDom(id) {
  if (openTranslations.has(id)) {
    openTranslations.delete(id);
  } else {
    openTranslations.add(id);
  }

  const isVisible = openTranslations.has(id);
  document.querySelectorAll(`[data-tr-toggle="${CSS.escape(id)}"]`).forEach((el) => {
    if (el.hasAttribute('aria-expanded')) {
      el.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    }
    if (el.classList.contains('story-sent')) {
      el.classList.toggle('is-active', isVisible);
    } else if (el.classList.contains('es-click') || el.classList.contains('story-para')) {
      el.classList.toggle('is-open', isVisible);
    }
  });
  document.querySelectorAll(`[data-tr-target="${CSS.escape(id)}"]`).forEach((el) => {
    el.classList.toggle('is-visible', isVisible);
  });
}

document.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof Element)) return;

  const navBtn = target.closest('[data-nav-tab]');
  if (navBtn) {
    e.preventDefault();
    const tab = navBtn.getAttribute('data-nav-tab');
    if (tab && tab !== state.activeTab) {
      state.activeTab = tab;
      saveState();
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }

  if (target.closest('[data-close-all-hy]')) {
    openTranslations.clear();
    renderApp();
    return;
  }

  const modeBtn = target.closest('[data-story-mode]');
  if (modeBtn) {
    const mode = modeBtn.getAttribute('data-story-mode');
    if (mode === 'paragraph' || mode === 'sentence') {
      state.storyMode = mode;
      saveState();
      renderApp();
    }
    return;
  }

  const trBtn = target.closest('[data-tr-toggle]');
  if (trBtn) {
    const id = trBtn.getAttribute('data-tr-toggle');
    if (id) toggleTranslationDom(id);
    return;
  }

  const speakBtn = target.closest('[data-speak]');
  if (speakBtn) {
    const txt = speakBtn.getAttribute('data-speak');
    if (txt) speakSpanish(txt);
    return;
  }

  const ansToggle = target.closest('[data-toggle-ans]');
  if (ansToggle) {
    const k = ansToggle.getAttribute('data-toggle-ans');
    if (k) {
      if (openAnswers.has(k)) openAnswers.delete(k);
      else openAnswers.add(k);
      renderApp();
    }
    return;
  }

  const clearInput = target.closest('[data-clear-input]');
  if (clearInput) {
    const k = clearInput.getAttribute('data-clear-input');
    if (k) {
      delete state.answers[k];
      saveState();
      renderApp();
    }
    return;
  }

  const selBtn = target.closest('[data-select-ans]');
  if (selBtn) {
    const key = selBtn.getAttribute('data-select-ans');
    const rawVal = selBtn.getAttribute('data-select-val');
    if (key && rawVal !== null) {
      state.answers[key] = /^\d+$/.test(rawVal) ? Number(rawVal) : rawVal;
      saveState();
      renderApp();
    }
    return;
  }

  const checkBtn = target.closest('[data-check-group]');
  if (checkBtn) {
    const group = checkBtn.getAttribute('data-check-group');
    if (group) {
      state.checked[group] = true;
      saveState();
      renderApp();
    }
    return;
  }

  const resetBtn = target.closest('[data-reset-group]');
  if (resetBtn) {
    const group = resetBtn.getAttribute('data-reset-group');
    const keysStr = resetBtn.getAttribute('data-reset-keys') || '';
    if (group) {
      delete state.checked[group];
      keysStr
        .split(',')
        .filter(Boolean)
        .forEach((k) => delete state.answers[k]);
      saveState();
      renderApp();
    }
    return;
  }

  const addOrd = target.closest('[data-order-add]');
  if (addOrd) {
    const id = addOrd.getAttribute('data-order-add');
    if (id && !state.orderSelection.includes(id)) {
      state.orderSelection.push(id);
      delete state.checked['ex3_order'];
      saveState();
      renderApp();
    }
    return;
  }
  const remOrd = target.closest('[data-order-remove]');
  if (remOrd) {
    const id = remOrd.getAttribute('data-order-remove');
    state.orderSelection = state.orderSelection.filter((x) => x !== id);
    delete state.checked['ex3_order'];
    saveState();
    renderApp();
    return;
  }
  if (target.closest('[data-order-reset]')) {
    state.orderSelection = [];
    delete state.checked['ex3_order'];
    saveState();
    renderApp();
    return;
  }

  const thFilter = target.closest('[data-theory-filter]');
  if (thFilter) {
    state.theoryLevelFilter = thFilter.getAttribute('data-theory-filter') || 'all';
    renderApp();
    return;
  }

  const romBtn = target.closest('[data-romance-verse]');
  if (romBtn) {
    state.activeRomanceVerse = Number(romBtn.getAttribute('data-romance-verse'));
    saveState();
    renderApp();
    return;
  }

  const gramBtn = target.closest('[data-gram-word]');
  if (gramBtn) {
    state.activeGrammarWord = gramBtn.getAttribute('data-gram-word') || 'w1';
    saveState();
    renderApp();
    return;
  }

  if (target.closest('[data-reset-all]')) {
    state.answers = {};
    state.checked = {};
    state.orderSelection = [];
    openAnswers.clear();
    openTranslations.clear();
    saveState();
    renderApp();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.matches('[data-tr-toggle]')) {
    e.preventDefault();
    target.click();
  }
});

document.addEventListener('input', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-input-key]')) {
    const key = target.getAttribute('data-input-key');
    if (key) {
      state.answers[key] = target.value;
      saveState();
    }
    return;
  }

  if (target.matches('[data-theory-search]')) {
    state.theorySearch = target.value;
    const cursorPos = target.selectionStart;
    renderApp();
    const inputEl = document.querySelector('[data-theory-search]');
    if (inputEl instanceof HTMLInputElement) {
      inputEl.focus();
      if (cursorPos !== null) inputEl.setSelectionRange(cursorPos, cursorPos);
    }
  }
});

document.addEventListener('change', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const key = target.getAttribute('data-select-input');
  if (key) {
    state.answers[key] = target.value;
    saveState();
    renderApp();
  }
});

renderApp();
