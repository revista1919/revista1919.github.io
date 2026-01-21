// English Version: AdminSectionEN.jsx
import React from 'react';
import { motion } from 'framer-motion';

function AdminSectionEN() {
  const roles = [
    {
      name: 'Founder',
      category: 'Direction',
      description: 'Person who initiated the project, defining its vision and initial objectives. Oversees the strategic direction of the journal.',
      isPostulable: false,
    },
    {
      name: 'Co-Founder',
      category: 'Direction',
      description: 'Key collaborator in the founding of the project, supporting the Founder in strategic decision-making.',
      isPostulable: false,
    },
    {
      name: 'General Director',
      category: 'Direction',
      description: 'Responsible for the overall vision, team coordination, external relations, and global oversight of the journal.',
      isPostulable: false,
    },
    {
      name: 'Deputy General Director',
      category: 'Direction',
      description: 'Assists the General Director in strategic decisions and assumes direction in their absence.',
      isPostulable: false,
    },
    {
      name: 'Editor-in-Chief',
      category: 'Editorial',
      description: 'Oversees all content and coordinates the editorial team. Ensures the quality of articles.',
      isPostulable: false,
    },
    {
      name: 'Section Editor',
      category: 'Editorial',
      description: 'Reviews and edits texts from a specific section (e.g., Opinion, Culture, Current Affairs). Votes on whether to publish a work. Mainly applies corrections made by reviewers. Responsible for communicating with the author to request data and provide feedback.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Section+Editor'
    },
    {
      name: 'Reviewer / Editorial Committee',
      category: 'Editorial',
      description: 'Corrects style, spelling, and coherence of articles. Additionally, a reviewer can check sources, verify their quality and content. Provides feedback to authors and votes on whether to publish an article.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Reviewer'
    },
    {
      name: 'Article Assignment Manager',
      category: 'Editorial',
      description: 'Receives, organizes, and channels article submissions to reviewers and editors.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Article+Assignment+Manager'
    },
    {
      name: 'Web Development Manager',
      category: 'Technology',
      description: 'Manages the website, fixes technical errors, and implements design and functionality improvements.',
      isPostulable: false,
    },
    {
      name: 'Technical Support Manager',
      category: 'Technology',
      description: 'Resolves technical issues related to content upload, forms, and emails.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Technical+Support+Manager'
    },
    {
      name: 'Social Media Manager',
      category: 'Communications',
      description: 'Manages social media (Instagram, X, TikTok, etc.), posts content, and promotes the journal.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Social+Media+Manager'
    },
    {
      name: 'Graphic Designer',
      category: 'Design',
      description: 'Creates visual material such as posters, covers, and templates for social media.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Graphic+Designer'
    },
    {
      name: 'Community Manager',
      category: 'Communications',
      description: 'Interacts with the community, responds to messages, and encourages participation on the journal\'s platforms.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Community+Manager'
    },
    {
      name: 'New Collaborators Manager',
      category: 'Operations',
      description: 'Guides new applicants for administrative roles, reviewers, or editors.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=New+Collaborators+Manager'
    },
    {
      name: 'Events or Calls Coordinator',
      category: 'Operations',
      description: 'Organizes talks, debates, contests, or other activities to promote the journal.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Events+or+Calls+Coordinator'
    },
    {
      name: 'Legal/Editorial Advisor',
      category: 'Consulting',
      description: 'Reviews legal terms, editorial standards, and copyrights for the journal.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Legal/Editorial+Advisor'
    },
    {
      name: 'Finance / Transparency Manager',
      category: 'Finance',
      description: 'Manages donations or budgets, ensuring financial transparency.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Finance+/+Transparency+Manager'
    },
    {
      name: 'Academic Advisor',
      category: 'Consulting',
      description: 'Verifies the quality of a volume and is available for specific consultations.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=English&entry.324949366=Academic+Advisor'
    },
  ];

  // Group roles by category for a more professional reading
  const categories = [...new Set(roles.map(r => r.category))];

  return (
    <section className="max-w-7xl mx-auto px-4 py-20 bg-white">
      {/* Editorial Style Header */}
      <div className="border-b-2 border-black pb-8 mb-16 text-center md:text-left">
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] block mb-2">
          Academic Opportunities
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-6">
          Call for Collaborators
        </h2>
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <p className="text-lg text-gray-600 max-w-3xl font-serif italic leading-relaxed">
            "We seek minds committed to excellence and scientific dissemination. Join a global network of students and academics dedicated to intellectual rigor."
          </p>
          <a
            href="https://www.revistacienciasestudiantes.com/policiesAppEN.html"
            className="text-[11px] font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-[#007398] hover:border-[#007398] transition-all whitespace-nowrap"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View application policies"
          >
            View Application Policies →
          </a>
        </div>
      </div>
      {/* Categories Grid */}
      <div className="space-y-20">
        {categories.map((cat) => (
          <div key={cat} className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Category Title Lateral */}
            <div className="lg:col-span-1">
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 border-l-2 border-gray-100 pl-4 py-1">
                {cat}
              </h3>
            </div>
            {/* Roles in the category */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.filter(r => r.category === cat).map((role) => (
                <motion.div
                  key={role.name}
                  whileHover={{ y: -4 }}
                  className={`group relative p-6 border rounded-sm transition-all duration-300 ${
                    role.isPostulable
                      ? 'border-gray-200 hover:border-[#007398] bg-white shadow-sm hover:shadow-md'
                      : 'border-gray-100 bg-gray-50 opacity-80'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-serif font-bold text-gray-900 group-hover:text-[#007398] transition-colors">
                      {role.name}
                    </h4>
                    {role.isPostulable && (
                      <span className="text-[9px] bg-[#007398]/10 text-[#007398] px-2 py-0.5 font-bold uppercase tracking-tighter">
                        Open
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 font-serif italic">
                    {role.description}
                  </p>
                  {role.isPostulable ? (
                    <button
                      onClick={() => window.open(role.link, '_blank')}
                      className="w-full py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#007398] transition-colors rounded-sm"
                      aria-label={`Apply for the role ${role.name}`}
                    >
                      Submit Application
                    </button>
                  ) : (
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-medium italic">
                      Defined Institutional Position
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Subtle Footer */}
      <div className="mt-24 pt-12 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400 font-serif leading-relaxed">
          The National Review of Sciences for Students does not discriminate based on origin, gender, or institution.<br/>
          All applications are reviewed by our committee.
        </p>
      </div>
    </section>
  );
}

export default AdminSectionEN;
