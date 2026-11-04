import type { Protocol } from "@/lib/irerc/model";

/**
 * Official AAPHREML-IRERC clearance / facility-access letter.
 *
 * The wording, letterhead, reference fields and signatories are reproduced from
 * the production system's letter. Do not introduce generic or substitute text.
 * It is only rendered after an approved committee decision has been recorded.
 */
export function ClearanceLetter({ protocol, date }: { protocol: Protocol; date?: string }) {
  const submission = protocol.submission;
  const piName = submission?.piName || protocol.pi;
  const studyTitle = submission?.studyTitle || protocol.title;
  const institution = submission?.college === "Other:" ? submission.collegeOther : submission?.college || protocol.institution;
  const sites = (submission?.specificSite || protocol.site || institution || "")
    .split(/\s*[,;]\s*|\s+and\s+/i)
    .map((site) => site.trim())
    .filter(Boolean);
  const refDate = date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <article className="certificate-surface print-certificate mx-auto w-full max-w-4xl border border-slate-300 px-8 py-8 text-slate-800 shadow-sm sm:px-10">
      <header className="flex flex-wrap items-center justify-center gap-4 border-b-2 border-[#c8972a] pb-4">
        <img src="/logo.png" alt="Addis Ababa City Administration Health Bureau" className="size-16 shrink-0 rounded-full object-cover" />
        <div className="min-w-48 flex-1 text-center">
          <p className="text-[9px] font-bold tracking-[0.5px] text-slate-500 uppercase">Federal Democratic Republic of Ethiopia</p>
          <p className="text-[15px] leading-tight font-extrabold tracking-[0.3px] text-[#0f2744] uppercase">Addis Ababa City Administration Health Bureau</p>
          <p className="mt-1 text-[12px] font-bold text-[#c8972a]">Institutional Research Ethics Review Committee</p>
          <p className="mt-0.5 text-[10px] text-slate-500">P.O. Box 22212, Addis Ababa, Ethiopia</p>
        </div>
        <img src="/logo.png" alt="" className="size-16 shrink-0 rounded-full object-cover opacity-40" />
      </header>

      <div className="mt-5 text-[13px] leading-[1.85] text-slate-800">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
          <p><strong>REF. NO.:</strong> {protocol.id}</p>
          <p><strong>DATE:</strong> {refDate}</p>
        </div>

        <div className="mb-3">
          <strong>TO:</strong>
          {sites.length ? sites.map((site) => <div key={site} className="pl-2.5">{site}</div>) : <div className="pl-2.5">{institution}</div>}
        </div>

        <p className="mb-3 font-bold underline">Subject: Permission to Access Facility for Approved Research</p>

        <p className="mb-3 text-justify">
          This letter is issued to formally introduce and support <strong>{piName}</strong>, who has
          received ethical approval to conduct a research study entitled:
        </p>

        <div className="my-3 rounded-md border-l-4 border-[#c8972a] bg-slate-50 px-3.5 py-2.5 text-[13.5px] leading-snug font-bold break-words text-[#0f2744]">
          “{studyTitle}”
        </div>

        <p className="mb-3 text-justify">
          The study proposal has been thoroughly reviewed and approved by the{" "}
          <strong>Addis Ababa City Administration Health Bureau Institutional Research Ethics Review Committee (AAPHREML-IRERC)</strong>{" "}
          in accordance with established ethical standards. The researcher is required to adhere to
          all institutional regulations during data collection and submit progress and final reports
          to the Committee as expected.
        </p>

        <p className="mb-3 text-justify">
          Accordingly, we kindly request your institution&apos;s cooperation in granting access to the
          relevant departments, staff, clients, or data sources to facilitate the successful
          completion of this ethically approved research.
        </p>

        <p className="mb-5 text-justify">
          Your support in enabling this academic and public health effort is highly appreciated.
        </p>

        <p className="mb-4"><strong>With Regards,</strong></p>

        <div className="mt-4 flex flex-wrap justify-around gap-5 border-t border-slate-200 pt-4">
          <div className="min-w-36 flex-1 text-center">
            <img src="/signature.png" alt="Chairperson signature" className="mx-auto mb-1 block h-11 max-w-32 object-contain" />
            <div className="border-t-[1.5px] border-slate-700 pt-1.5">
              <p className="text-[12.5px] font-bold text-slate-900">Asmamaw Deguale</p>
              <p className="text-[10.5px] text-slate-500">Chairperson, AAPHREML-IRERC</p>
              <p className="text-[10px] text-slate-500">Addis Ababa City Administration Health Bureau</p>
            </div>
          </div>
          <div className="min-w-36 flex-1 text-center">
            <div className="mb-1 flex h-11 items-end justify-center">
              <span className="font-serif text-[17px] text-slate-700 italic">Alem Nigussie</span>
            </div>
            <div className="border-t-[1.5px] border-slate-700 pt-1.5">
              <p className="text-[12.5px] font-bold text-slate-900">Alem Nigussie</p>
              <p className="text-[10.5px] text-slate-500">Secretary, AAPHREML-IRERC</p>
              <p className="text-[10px] text-slate-500">Addis Ababa City Administration Health Bureau</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border-[1.5px] border-dashed border-[#c8972a] px-2.5 py-2 text-center text-[10px] font-bold break-words text-amber-700">
          OFFICIAL SEAL — ADDIS ABABA CITY ADMINISTRATION HEALTH BUREAU
        </div>
      </div>
    </article>
  );
}
