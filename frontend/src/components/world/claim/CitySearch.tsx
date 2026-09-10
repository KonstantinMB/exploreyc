// City search — the equal, and only keyboard-operable, alternative to clicking
// the globe.
//
// Clicking a sphere is not a keyboard gesture, so without this control the
// claim flow simply could not be started from a keyboard. That makes this an
// accessibility path, not a convenience: it implements the full ARIA 1.2
// combobox-with-listbox pattern — `role="combobox"` on the input,
// `aria-expanded`/`aria-controls`/`aria-activedescendant` wired to a real
// `role="listbox"`, arrow keys to move, Home/End to jump, Enter to choose,
// Escape to close (then to clear), and a polite live region that says how many
// cities matched and how many are on screen.
//
// Selecting a city hands back the same {lat, lng} a globe click produces, so
// the page treats the two identically — same server geography check, same
// readout, same flight.

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { HINT, INPUT, LABEL, SANS } from './styles'
import {
  cityLabel,
  countryName,
  formatPopulation,
  loadCities,
  matchCities,
  type City,
} from './cityIndex'

/** Results rendered at once. Everything beyond this is counted, not drawn. */
const RESULT_LIMIT = 20

/** Keystroke settle time before re-filtering. Long enough to skip most of a
 *  fast typist's intermediate states, short enough to feel instant. */
const DEBOUNCE_MS = 140

export interface CitySearchProps {
  /** Called with the chosen city — same contract as a globe click. */
  onSelect: (city: City) => void
  /** Lets the page move focus here ("Change", "Choose a spot"). */
  inputRef?: RefObject<HTMLInputElement | null>
  /** Visible label above the field. */
  label?: string
  /**
   * Where the results list is drawn.
   *
   * `overlay` (default) floats it over whatever is beneath — right for a
   * control sitting on an open page. `inline` puts it in normal flow instead,
   * which is the only thing that works inside the claim wizard: that panel's
   * body is an `overflow-y:auto` scroll region, and a scroll region CLIPS its
   * absolutely-positioned descendants, so a floating list would have been cut
   * off after a row and a half. In flow the panel simply grows and scrolls.
   *
   * The ARIA contract is identical either way — a `listbox` does not have to
   * float to be a combobox popup.
   */
  resultsPlacement?: 'overlay' | 'inline'
  className?: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export function CitySearch({
  onSelect,
  inputRef,
  label = 'Search for a city',
  resultsPlacement = 'overlay',
  className,
}: CitySearchProps) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-list`
  const statusId = `${baseId}-status`
  const optionId = (index: number) => `${baseId}-opt-${index}`

  const ownRef = useRef<HTMLInputElement>(null)
  const field = inputRef ?? ownRef
  const listRef = useRef<HTMLUListElement>(null)

  const [cities, setCities] = useState<City[]>([])
  const [load, setLoad] = useState<LoadState>('idle')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  // The highlight is stored WITH the query it belongs to, so a new query
  // starts at the first row without an effect that resets it after the fact.
  const [highlight, setHighlight] = useState<{ query: string; index: number }>({
    query: '',
    index: 0,
  })
  // The label of the city currently sitting in the field. Without it the
  // status line would re-filter on "Sofia, Bulgaria" a moment after the pick
  // and announce "No cities match" about a city that was just chosen.
  const [chosenLabel, setChosenLabel] = useState<string | null>(null)

  // The set is only fetched when somebody actually engages with the search, so
  // a visitor who just clicks the globe never pays for it. Focus counts as
  // engagement, which means a keyboard user's download starts one Tab before
  // their first keystroke.
  const requestCities = () => {
    if (load !== 'idle') return
    setLoad('loading')
    loadCities().then(
      (rows) => {
        setCities(rows)
        setLoad('ready')
      },
      () => setLoad('error'),
    )
  }

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  const { shown, total } = useMemo(
    () => matchCities(cities, debounced, RESULT_LIMIT),
    [cities, debounced],
  )

  const hasResults = shown.length > 0
  const listOpen = open && hasResults

  // A fresh result set always starts on its first row, so Enter right after
  // typing chooses the most likely city rather than nothing at all. The result
  // set can also shrink without the query changing (the city list finishing
  // its download does exactly that), so the index is clamped as well —
  // aria-activedescendant must never name a row that is not in the document.
  const activeIndex = Math.min(
    highlight.query === debounced ? highlight.index : 0,
    Math.max(0, shown.length - 1),
  )
  const setActive = (index: number) => setHighlight({ query: debounced, index })

  // Keep the highlighted row inside the scroll box on arrow-key travel.
  useEffect(() => {
    if (!listOpen) return
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listOpen])

  const choose = (city: City) => {
    const label = cityLabel(city)
    setQuery(label)
    setDebounced(label)
    setChosenLabel(label)
    setOpen(false)
    onSelect(city)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      requestCities()
      if (!hasResults) return
      setOpen(true)
      if (!listOpen) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + shown.length) % shown.length)
      return
    }
    if (event.key === 'Home' && listOpen) {
      event.preventDefault()
      setActive(0)
      return
    }
    if (event.key === 'End' && listOpen) {
      event.preventDefault()
      setActive(shown.length - 1)
      return
    }
    if (event.key === 'Enter') {
      // Never let Enter here reach an enclosing form: this control chooses a
      // city, it does not advance or submit anything.
      if (listOpen && shown[activeIndex]) {
        event.preventDefault()
        choose(shown[activeIndex])
      } else if (query.trim() !== '') {
        event.preventDefault()
      }
      return
    }
    if (event.key === 'Escape') {
      // First Escape closes the list, a second one clears the field — the
      // usual two-stage behaviour, so neither action is a surprise.
      if (listOpen) {
        event.preventDefault()
        setOpen(false)
      } else if (query !== '') {
        event.preventDefault()
        setQuery('')
        setChosenLabel(null)
      }
    }
  }

  const clear = () => {
    setQuery('')
    setChosenLabel(null)
    setOpen(false)
    field.current?.focus()
  }

  /** One sentence, rendered visibly AND announced politely. */
  const statusText = (() => {
    if (load === 'error') {
      return 'City search is unavailable right now. You can still click the globe to choose a spot.'
    }
    if (load === 'loading' && query.trim() !== '') return 'Loading cities…'
    // Deliberately silent once a city has been chosen. The check itself still
    // matters — without it the field re-filters on "Sofia, Bulgaria" a moment
    // after the pick and announces "No cities match" about the city just
    // chosen — but it used to also print "Sofia, Bulgaria chosen." directly
    // above a readout card saying "Sofia, Bulgaria". Two live regions, one
    // fact, and a screen reader heard the place name twice in a row. The
    // readout is the better of the two: it carries the SERVER's name for the
    // point, which is what will actually be stored.
    if (chosenLabel !== null && query === chosenLabel) return ''
    if (debounced.trim() === '') return ''
    if (total === 0) return `No cities match “${debounced.trim()}”. Try another spelling.`
    if (total > shown.length) {
      return `${total} cities match. Showing the ${shown.length} largest — keep typing to narrow it down.`
    }
    return `${total} ${total === 1 ? 'city matches' : 'cities match'}.`
  })()

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)} style={SANS}>
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          ref={field}
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listOpen ? optionId(activeIndex) : undefined}
          aria-describedby={statusId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Sofia, Berlin, São Paulo…"
          className={cn(INPUT, 'pl-10 pr-10')}
          style={SANS}
          value={query}
          onFocus={requestCities}
          onChange={(event) => {
            setQuery(event.target.value)
            setChosenLabel(null)
            setOpen(true)
            requestCities()
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
        />

        {load === 'loading' ? (
          <Loader2
            aria-hidden="true"
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
        ) : query !== '' ? (
          <button
            type="button"
            onClick={clear}
            className={cn(
              'world-focus absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center',
              'rounded-full',
              'text-muted-foreground transition-colors duration-150',
              'hover:bg-[#FB651E]/[0.05] hover:text-[#FB651E]',
              'active:translate-y-[calc(-50%+1px)] motion-reduce:transition-none',
            )}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Clear the search</span>
          </button>
        ) : null}
      </div>

      {/* Always in the DOM so the live region is there before it has anything
          to say — a region added at the same moment as its text is frequently
          not announced at all. */}
      <p id={statusId} role="status" aria-live="polite" className={cn(HINT, 'min-h-[1.1rem]')}>
        {statusText}
      </p>

      {/* The popup. `listbox` is only rendered when it has options in it, so a
          screen reader is never handed an empty list to explore. */}
      {listOpen ? (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label="City results"
          className={cn(
            'world-scroll-list z-30 mt-1 overflow-y-auto overscroll-contain rounded-sm border border-border bg-card p-1.5 shadow-lg',
            resultsPlacement === 'overlay'
              ? 'absolute left-0 right-0 top-full max-h-[15rem]'
              // Shorter in flow: the list is pushing the rest of the step down
              // rather than covering it, and on a phone the wizard sheet is
              // only about half the viewport tall. Four-and-a-bit rows still
              // show, and the region scrolls for the rest.
              : 'max-h-[13rem]',
          )}
        >
          {shown.map((city, index) => {
            const isActive = index === activeIndex
            return (
              <li
                key={city.id}
                id={optionId(index)}
                role="option"
                aria-selected={isActive}
                aria-label={cityLabel(city)}
                // Keeps focus in the input, so the combobox never loses its
                // aria-activedescendant relationship mid-click.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(city)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2',
                  'min-h-[2.75rem] text-sm transition-colors duration-100 motion-reduce:transition-none',
                  isActive
                    ? 'bg-[#FB651E]/[0.05] text-foreground'
                    : 'text-foreground',
                )}
              >
                <MapPin
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive
                      ? 'text-[#FB651E]'
                      : 'text-muted-foreground',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{city.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {countryName(city.iso)}
                  </span>
                </span>
                {city.population > 0 ? (
                  <span
                    aria-hidden="true"
                    className="world-num shrink-0 text-xs text-muted-foreground"
                  >
                    {formatPopulation(city.population)}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default CitySearch
