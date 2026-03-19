import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Wifi } from 'lucide-react';

const stepThemes = [
  {
    id: 1,
    title: 'Identity',
    description: 'Tell us who you are and where you want to go.',
    banner: 'bg-rose-100',
  },
  {
    id: 2,
    title: 'Habits',
    description: 'How you study and show up every week.',
    banner: 'bg-amber-100',
  },
  {
    id: 3,
    title: 'Profile',
    description: 'Your experience and community footprint.',
    banner: 'bg-blue-100',
  },
  {
    id: 4,
    title: 'Wellness',
    description: 'Balance check-in before we build the plan.',
    banner: 'bg-emerald-100',
  },
  {
    id: 5,
    title: 'Account',
    description: 'Create your sign-in credentials before finishing.',
    banner: 'bg-violet-100',
  },
];

const techSkillOptions = ['Python', 'Java', 'React', 'SQL', 'UI/UX', 'Cloud', 'Data Science', 'AI/ML'];
const interestOptions = ['Product', 'Startups', 'Research', 'Hackathons', 'Open Source', 'Design', 'Fintech', 'HealthTech'];
const clubOptions = ['Debate Club', 'Coding Club', 'Sports Team', 'Art Club', 'Music Club', 'Volunteering'];

const travelTimeOptions = [
  { label: '<15 min', value: 1 },
  { label: '15-30 min', value: 2 },
  { label: '30-60 min', value: 3 },
  { label: '>1 hour', value: 4 },
];

const softSkillsList = [
  { key: 'communication', label: 'Communication' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'analytical', label: 'Analytical' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'networking', label: 'Networking' },
];

const OnboardingFlow = ({ onBackToLanding, onComplete }) => {
  const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    ug_course: '',
    specialization: '',
    cgpa: 75,
    target_goal: '',
    tech_skills: [],
    interests: [],

    weekly_study_hours: 12,
    exam_prep_method: '',
    internet_access: true,
    free_time: 3,
    go_out_freq: 2,
    travel_time: 2,
    failures: 0,
    school_support: false,
    family_support: true,
    paid_classes: false,
    attendance: 85,
    scholarship_status: false,

    internship_count: 0,
    project_count: 0,
    leadership_roles: false,
    club_memberships: [],
    communication: 3,
    problem_solving: 3,
    teamwork: 3,
    analytical: 3,
    presentation: 2,
    networking: 2,

    sleep_hours: 7,
    sleep_quality: 2,
    stress_level: 3,
    physical_activity_min: 30,
    diet_quality: 1,
    activity_type: 'Walking',
    activity_frequency: 3,

    email: '',
    password: '',
  });

  const theme = useMemo(() => stepThemes[step - 1], [step]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSelection = (field, item) => {
    setFormData((prev) => {
      const current = prev[field];
      if (current.includes(item)) {
        return { ...prev, [field]: current.filter((entry) => entry !== item) };
      }
      return { ...prev, [field]: [...current, item] };
    });
  };

  const goNext = () => setStep((prev) => Math.min(prev + 1, 5));
  const goBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleFinish = async () => {
    const email = String(formData.email || '').trim().toLowerCase();
    const password = String(formData.password || '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingUserId = localStorage.getItem('urway_user_id') || '';
      const payload = { ...formData, email, password, userId: existingUserId };

      const response = await fetch(`${apiBaseUrl}/api/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.error || data?.message || 'Failed to complete onboarding'
        );
      }

      localStorage.setItem('urway_user_id', data?.userId || existingUserId);
      onComplete?.(data);
    } catch (error) {
      console.error('Error calling backend:', error);
      alert(
        error?.message || 'Something went wrong while connecting to the recommendation engine.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => onBackToLanding?.()}
            className="inline-flex items-center gap-2 rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-900 hover:text-white transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-sm font-semibold">Step {String(step).padStart(2, '0')} / 05</div>
        </div>

        <div className="space-y-10">
          <div className={`rounded-3xl border-2 border-neutral-900 ${theme.banner} px-8 py-6 shadow-[6px_6px_0_#18181B]`}>
            <h2 className="font-display text-3xl font-bold tracking-tight">{theme.title}</h2>
            <p className="text-neutral-700 mt-1">{theme.description}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {step === 1 && (
                <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider">Current Course</label>
                      <select
                        className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
                        onChange={(e) => handleChange('ug_course', e.target.value)}
                        value={formData.ug_course}
                      >
                        <option value="">Select course</option>
                        <option value="B.Tech">B.Tech / B.E</option>
                        <option value="B.Sc">B.Sc</option>
                        <option value="BCA">BCA</option>
                        <option value="Medical">Medical / MBBS</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider">Specialization</label>
                      <input
                        type="text"
                        placeholder="e.g. Computer Science"
                        className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
                        onChange={(e) => handleChange('specialization', e.target.value)}
                        value={formData.specialization}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider">Current Score (CGPA/%)</label>
                      <span className="font-semibold text-lg">{formData.cgpa}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.cgpa}
                      onChange={(e) => handleChange('cgpa', Number(e.target.value))}
                      className="mt-3 w-full range-black"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider">Attendance</label>
                      <span className="font-semibold text-lg">{formData.attendance}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.attendance}
                      onChange={(e) => handleChange('attendance', Number(e.target.value))}
                      className="mt-3 w-full range-black"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Primary Goal</label>
                    <div className="mt-3 grid md:grid-cols-2 gap-4">
                      {['Placement', 'Masters', 'Govt', 'Freelance'].map((goal) => (
                        <button
                          key={goal}
                          onClick={() => handleChange('target_goal', goal)}
                          className={`rounded-3xl border-2 border-neutral-900 px-5 py-4 text-left font-medium transition ${
                            formData.target_goal === goal ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'
                          }`}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleChange('scholarship_status', !formData.scholarship_status)}
                    className={`rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-semibold ${formData.scholarship_status ? 'bg-neutral-900 text-white' : 'bg-white'}`}
                  >
                    Scholarship: {formData.scholarship_status ? 'Yes' : 'No'}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider">Weekly Study Hours</label>
                      <span className="font-semibold text-lg">{formData.weekly_study_hours} hrs</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={formData.weekly_study_hours}
                      onChange={(e) => handleChange('weekly_study_hours', Number(e.target.value))}
                      className="mt-3 w-full range-black"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Travel Time to College</label>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {travelTimeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleChange('travel_time', opt.value)}
                          className={`rounded-2xl border-2 border-neutral-900 px-3 py-3 text-sm font-medium transition ${
                            formData.travel_time === opt.value ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      ['school_support', 'School Support'],
                      ['family_support', 'Family Support'],
                      ['paid_classes', 'Paid Tutoring'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between rounded-2xl border-2 border-neutral-900 px-4 py-3">
                        <div className="text-sm font-medium">{label}</div>
                        <button
                          onClick={() => handleChange(key, !formData[key])}
                          className={`rounded-full border-2 border-neutral-900 px-3 py-1 text-xs font-semibold ${formData[key] ? 'bg-neutral-900 text-white' : 'bg-white'}`}
                        >
                          {formData[key] ? 'Yes' : 'No'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded-3xl border-2 border-neutral-900 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl border-2 border-neutral-900 flex items-center justify-center">
                        <Wifi size={18} />
                      </div>
                      <div>
                        <div className="font-semibold">Internet Access</div>
                        <div className="text-sm text-neutral-600">Toggle your connectivity</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleChange('internet_access', !formData.internet_access)}
                      className={`rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-semibold ${formData.internet_access ? 'bg-neutral-900 text-white' : 'bg-white'}`}
                    >
                      {formData.internet_access ? 'Yes' : 'No'}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-3xl border-2 border-neutral-900 px-6 py-5">
                      <label className="text-xs font-semibold uppercase tracking-wider">Internships</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.internship_count}
                        onChange={(e) => handleChange('internship_count', Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border-2 border-neutral-900 px-3 py-2"
                      />
                    </div>
                    <div className="rounded-3xl border-2 border-neutral-900 px-6 py-5">
                      <label className="text-xs font-semibold uppercase tracking-wider">Projects</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.project_count}
                        onChange={(e) => handleChange('project_count', Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border-2 border-neutral-900 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Tech Skills</label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {techSkillOptions.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleSelection('tech_skills', skill)}
                          className={`rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium ${
                            formData.tech_skills.includes(skill) ? 'bg-neutral-900 text-white' : 'bg-white'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Interests</label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {interestOptions.map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleSelection('interests', interest)}
                          className={`rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium ${
                            formData.interests.includes(interest) ? 'bg-neutral-900 text-white' : 'bg-white'
                          }`}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Club Memberships</label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {clubOptions.map((club) => (
                        <button
                          key={club}
                          onClick={() => toggleSelection('club_memberships', club)}
                          className={`rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium ${
                            formData.club_memberships.includes(club) ? 'bg-neutral-900 text-white' : 'bg-white'
                          }`}
                        >
                          {club}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {softSkillsList.map((skill) => (
                      <div key={skill.key}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider">{skill.label}</label>
                          <span className="font-semibold">{formData[skill.key]}/5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={formData[skill.key]}
                          onChange={(e) => handleChange(skill.key, Number(e.target.value))}
                          className="mt-3 w-full range-black"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8">
                  {[['sleep_hours', 'Sleep Hours', 0, 12], ['stress_level', 'Stress Level', 1, 5], ['physical_activity_min', 'Physical Activity (mins/day)', 0, 180], ['activity_frequency', 'Activity Frequency (days/week)', 0, 7]].map(([key, label, min, max]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider">{label}</label>
                        <span className="font-semibold text-lg">{formData[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={formData[key]}
                        onChange={(e) => handleChange(key, Number(e.target.value))}
                        className="mt-3 w-full range-black"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider">Activity Type</label>
                    <select
                      value={formData.activity_type}
                      onChange={(e) => handleChange('activity_type', e.target.value)}
                      className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3"
                    >
                      {['Walking', 'Running', 'Gym', 'Yoga', 'Sports', 'Dance', 'None'].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-8">
                  <div className="rounded-3xl border-2 border-neutral-900 px-6 py-5">
                    <label className="text-xs font-semibold uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="you@example.com"
                      className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
                    />
                  </div>

                  <div className="rounded-3xl border-2 border-neutral-900 px-6 py-5">
                    <label className="text-xs font-semibold uppercase tracking-wider">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="At least 8 characters"
                      className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
                    />
                    <p className="mt-2 text-sm text-neutral-600">
                      Use a strong password with letters, numbers, and symbols.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={step === 1}
              className="inline-flex items-center gap-2 rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < 5 ? (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {isSubmitting ? 'Generating...' : 'Finish'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
