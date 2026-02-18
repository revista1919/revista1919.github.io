import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import logo from '../../public/logoEN.png';

const HomeSection = ({ onOpenMenu }) => {
  const { switchLanguage, language } = useLanguage();
  const handleLanguageToggle = () => {
    switchLanguage(language === 'es' ? 'en' : 'es');
  };
  const cards = [
    {
      title: 'Articles',
      desc: 'Scientific articles written by students and peer-reviewed.',
      path: '/en/article/',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      bgImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=773&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Volumes',
      desc: 'Collections of articles organized by edition.',
      path: '/en/volume/',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      bgImage: 'https://plus.unsplash.com/premium_photo-1677567996070-68fa4181775a?q=80&w=872&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Manuscripts',
      desc: 'Information for authors and the submission process.',
      path: '/en/submit/',
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
      bgImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'News',
      desc: 'Announcements, activities, and updates from the student scientific community.',
      path: '/en/new/',
      icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
      bgImage: 'https://www.revistacienciasestudiantes.com/team.jpg'
    }
  ];
  const Card = ({ card, index }) => {
    const [imageLoaded, setImageLoaded] = React.useState(false);
    return (
      <motion.div
        key={card.path}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        onClick={() => window.location.href = `https://www.revistacienciasestudiantes.com${card.path}`}
        className="group relative h-[350px] sm:h-[400px] flex flex-col justify-end p-6 sm:p-8 overflow-hidden rounded-2xl cursor-pointer bg-gray-100 transition-all shadow-sm hover:shadow-2xl"
      >
        {card.bgImage && (
          <>
            <img
              src={card.bgImage}
              alt=""
              onLoad={() => setImageLoaded(true)}
              className={`absolute top-0 left-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
            <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-opacity" />
          </>
        )}
        <div className="relative z-10">
          <div className="bg-white/10 p-3 rounded-full mb-4 w-fit transition-colors group-hover:bg-blue-400/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {card.title}
          </h3>
          <p className="text-gray-200 mb-4">
            {card.desc}
          </p>
          <div className="inline-flex items-center gap-2 text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Explore</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-400/20 rounded-2xl pointer-events-none transition-all" />
      </motion.div>
    );
  };
  return (
    <div className="relative overflow-hidden bg-white">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-20 -right-20 w-64 h-64 sm:w-96 sm:h-96 bg-blue-200 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute top-1/4 -left-20 w-72 h-72 bg-gray-200 rounded-full blur-3xl"
        />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-20 sm:pt-6 sm:pb-32">
        {/* Integrated Header Elements */}
        <div className="flex items-center justify-between mb-8 sm:mb-12 relative">
          {/* LEFT SIDE */}
          <div className="flex-1 flex justify-start">
            <button
              onClick={onOpenMenu}
              className="group flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none"
              aria-label="Open menu"
            >
              <div className="space-y-1.5">
                <div className="w-5 h-0.5 bg-gray-900 rounded group-hover:w-6 transition-all"></div>
                <div className="w-6 h-0.5 bg-gray-900 rounded"></div>
                <div className="w-4 h-0.5 bg-gray-900 rounded group-hover:w-6 transition-all"></div>
              </div>
              <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Menu
              </span>
            </button>
          </div>
          {/* CENTER */}
          <div className="flex-shrink-0 px-4">
            <motion.div
              onClick={() => window.location.href = 'https://www.revistacienciasestudiantes.com/'}
              className="cursor-pointer flex flex-col items-center"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
            >
              <img
                src={logo}
                alt="Journal Logo"
                className="h-12 sm:h-16 w-auto object-contain drop-shadow-sm"
              />
              <div className="h-px w-8 bg-blue-200 mt-2 hidden sm:block"></div>
            </motion.div>
          </div>
          {/* RIGHT SIDE */}
          <div className="flex-1 flex justify-end">
            <motion.button
              onClick={handleLanguageToggle}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center bg-gray-100/80 backdrop-blur-sm border border-gray-200 p-1 rounded-full w-20 h-9 overflow-hidden shadow-sm"
              title={`Switch to ${language === 'es' ? 'English' : 'Spanish'}`}
            >
              <motion.div
                className="absolute top-1 bottom-1 w-[34px] bg-white rounded-full shadow-md z-0"
                initial={false}
                animate={{ x: language === 'es' ? 0 : 38 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
              <div className="relative z-10 flex w-full justify-around items-center text-[10px] font-bold tracking-tighter">
                <span className={language === 'es' ? 'text-blue-600' : 'text-gray-400'}>ES</span>
                <span className={language === 'en' ? 'text-blue-600' : 'text-gray-400'}>EN</span>
              </div>
            </motion.button>
          </div>
        </div>
        {/* HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-16 sm:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] mb-4 block text-center lg:text-left">
              The National Review of Sciences for Students · ISSN 3087-2839
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-bold text-gray-900 leading-[1.1] mb-6 text-center lg:text-left">
              A space for <br className="hidden sm:block" />
              <span className="italic text-gray-500 relative">
                student scientific work
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-blue-100 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 25 0 50 5 T 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" />
                </svg>
              </span>
            </h1>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="block lg:hidden w-full aspect-video mb-8 rounded-2xl overflow-hidden shadow-xl"
            >
              <img
                src="https://images.unsplash.com/photo-1616017640739-44ce2bfd9b4e?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Student scientific work"
                className="w-full h-full object-cover"
              />
            </motion.div>
            <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-10 font-light leading-relaxed max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              The National Review of Sciences for Students is a platform dedicated to the dissemination of scientific work developed by students, promoting learning and academic discussion.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => window.location.href = 'https://www.revistacienciasestudiantes.com/en/article/'}
                className="px-8 sm:px-10 py-4 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg hover:-translate-y-1 active:scale-95"
              >
                View articles
              </button>
              <button
                onClick={() => window.location.href = 'https://www.revistacienciasestudiantes.com/en/about/'}
                className="px-8 sm:px-10 py-4 border border-gray-200 text-gray-900 font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95"
              >
                About the journal
              </button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="hidden lg:block relative"
          >
            <div className="aspect-[4/5] bg-gray-100 rounded-2xl overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
              <img
                src="https://images.unsplash.com/photo-1616017640739-44ce2bfd9b4e?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Student scientific work"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <Card key={card.path} card={card} index={index} />
          ))}
        </div>
        {/* INVITATION */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 sm:mt-32 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-900 p-8 sm:p-12 lg:p-20 text-center"
        >
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white mb-6 italic">
              “Science is built by learning and sharing.”
            </h2>
            <p className="text-gray-400 font-light mb-8 sm:mb-10">
              We invite students interested in scientific communication to participate in the editorial project and in the different areas of work of the journal.
            </p>
            <button
              onClick={() => window.location.href = 'https://www.revistacienciasestudiantes.com/admin'}
              className="px-10 sm:px-12 py-4 bg-white text-gray-900 text-xs font-bold uppercase tracking-[0.3em] hover:bg-blue-500 hover:text-white transition-all"
            >
              Learn about the call
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
export default HomeSection;