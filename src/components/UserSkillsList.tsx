import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

type UserSkill = Tables<"user_skills">;

export const UserSkillsList: React.FC = () => {
  const [skills, setSkills] = useState<UserSkill[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("user_skills")
        .select("*");

      if (error) {
        console.error("Failed to fetch user_skills:", error);
        setError(error.message);
      } else {
        setSkills(data);
      }

      setLoading(false);
    };

    fetchSkills();
  }, []);

  if (loading) {
    return (
      <div className="rounded-md border border-[#424242] bg-[#181818] p-4 text-sm text-[#9E9E9E]">
        user_skills を読み込み中です…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-900/20 p-4 text-sm text-red-200">
        データの取得中にエラーが発生しました: {error}
      </div>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <div className="rounded-md border border-[#424242] bg-[#181818] p-4 text-sm text-[#9E9E9E]">
        user_skills テーブルにデータがありません。
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-[#424242] bg-[#181818] p-4 text-sm text-[#E0E0E0]">
      <h2 className="text-base font-semibold text-white">
        user_skills 一覧
      </h2>
      <ul className="space-y-2">
        {skills.map((skill) => (
          <li
            key={skill.id}
            className="rounded-md bg-black/20 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#9E9E9E]">
                user_id: {skill.user_id}
              </span>
              <span className="text-xs text-[#9E9E9E]">
                updated_at: {skill.updated_at ?? "-"}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div>
                <span className="text-[#9E9E9E]">IA: </span>
                <span>{skill.ia ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Interaction: </span>
                <span>{skill.interaction ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Presentation: </span>
                <span>{skill.presentation ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Prototype: </span>
                <span>{skill.prototype ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Visual: </span>
                <span>{skill.visual ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Accessibility: </span>
                <span>{skill.accessibility ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Facilitation: </span>
                <span>{skill.facilitation ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Implementation: </span>
                <span>{skill.implementation ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Qualitative Research: </span>
                <span>{skill.qualitative_research ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Quantitative Research: </span>
                <span>{skill.quantitative_research ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Strategy: </span>
                <span>{skill.strategy ?? "-"}</span>
              </div>
              <div>
                <span className="text-[#9E9E9E]">Writing: </span>
                <span>{skill.writing ?? "-"}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserSkillsList;

