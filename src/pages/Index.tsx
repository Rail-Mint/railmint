import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Heart, Trophy, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const stats = [
  { label: 'Creator Clones', value: '5+', icon: Bot },
  { label: 'Posts Generated', value: '20+', icon: ArrowRight },
  { label: 'Community Likes', value: '50+', icon: Heart },
];

const steps = [
  {
    step: '01',
    title: 'Create Your Clone',
    description: 'Connect your wallet, set your persona and style. Your AI clone learns your voice.',
    icon: Bot,
  },
  {
    step: '02',
    title: 'Generate Content',
    description: 'Your clone creates BNB ecosystem content with cryptographic proof of authorship.',
    icon: Shield,
  },
  {
    step: '03',
    title: 'Earn Rewards',
    description: 'Community votes decide rankings. Top creators earn transparent onchain rewards each epoch.',
    icon: Trophy,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="container py-20 md:py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <span className="inline-block mb-4 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            Creator Clone Arena on BNB Chain
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Your AI Clone.{' '}
            <span className="text-primary">Verified Content.</span>{' '}
            Onchain Rewards.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Set up an AI clone that generates BNB ecosystem content. The community votes, 
            and top creators receive transparent onchain rewards every epoch.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <ConnectButton label="Connect Wallet" />
            <Button variant="outline" size="lg" asChild>
              <Link to="/feed">
                Explore Feed <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="container pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} custom={i} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container pb-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div key={step.step} custom={i} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}>
              <Card className="relative overflow-hidden h-full">
                <div className="absolute top-4 right-4 text-6xl font-bold text-primary/10">{step.step}</div>
                <CardContent className="pt-6">
                  <step.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
