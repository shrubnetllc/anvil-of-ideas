import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIdeas } from "@/hooks/use-ideas";
import { InsertIdea, InsertLeanCanvas, canvasSections } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIdeaSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle, Circle, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewIdeaModalProps {
  open: boolean;
  onClose: () => void;
}

// Define our extended form data type that includes Lean Canvas fields
type IdeaFormData = {
  // Base idea fields
  title: string;      // Added title field
  idea: string;       // Now used as description
  founderName: string;
  founderEmail: string;
  companyStage: string;
  websiteUrl: string;
  companyName: string;
  // Lean Canvas fields
  leanCanvas: {
    problem: string;
    customerSegments: string;
    uniqueValueProposition: string;
    solution: string;
    channels: string;
    revenueStreams: string;
    costStructure: string;
    keyMetrics: string;
    unfairAdvantage: string;
  };
  // Optional additional fields
  tractionEvidence: {
    customerInterviews: number;
    waitlistSignups: number;
    payingCustomers: number;
  };
  targetLaunchDate: string;
  preferredPricingModel: string;
  additionalNotes: string;
  // Control fields for form
  confirmPassword?: string;
};

// Step interface
interface FormStep {
  id: string;
  title: string;
  description: string;
}

export function NewIdeaModal({ open, onClose }: NewIdeaModalProps) {
  const { createIdea, isCreating } = useIdeas();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Define our steps
  const steps: FormStep[] = [
    {
      id: "idea",
      title: "Basic Idea Information",
      description: "Provide the core details of your business idea. Only the idea description is required.",
    },
    {
      id: "company",
      title: "Company Details",
      description: "Share information about your company and founding team (optional).",
    },
    {
      id: "lean-canvas",
      title: "Lean Canvas Details",
      description: "Fill out the Lean Canvas sections to help validate your idea (optional).",
    },
    {
      id: "additional",
      title: "Additional Information",
      description: "Provide any additional information about your idea (optional).",
    },
  ];
  
  // Extended form schema with lean canvas fields
  const extendedIdeaSchema = insertIdeaSchema.extend({
    title: z.string().min(2, "Title must be at least 2 characters"),
    leanCanvas: z.object({
      problem: z.string().optional(),
      customerSegments: z.string().optional(),
      uniqueValueProposition: z.string().optional(),
      solution: z.string().optional(),
      channels: z.string().optional(),
      revenueStreams: z.string().optional(),
      costStructure: z.string().optional(),
      keyMetrics: z.string().optional(),
      unfairAdvantage: z.string().optional(),
    }).optional(),
    tractionEvidence: z.object({
      customerInterviews: z.number().optional(),
      waitlistSignups: z.number().optional(),
      payingCustomers: z.number().optional(),
    }).optional(),
    targetLaunchDate: z.string().optional(),
    preferredPricingModel: z.string().optional(),
    additionalNotes: z.string().optional(),
  });
  
  const form = useForm<IdeaFormData>({
    resolver: zodResolver(extendedIdeaSchema),
    defaultValues: {
      idea: "",
      founderName: "",
      founderEmail: "",
      companyStage: "none",
      websiteUrl: "",
      companyName: "",
      leanCanvas: {
        problem: "",
        customerSegments: "",
        uniqueValueProposition: "",
        solution: "",
        channels: "",
        revenueStreams: "",
        costStructure: "",
        keyMetrics: "",
        unfairAdvantage: "",
      },
      tractionEvidence: {
        customerInterviews: 0,
        waitlistSignups: 0,
        payingCustomers: 0,
      },
      targetLaunchDate: "",
      preferredPricingModel: "",
      additionalNotes: "",
    },
    mode: "onBlur",
  });
  
  // Extract base idea fields for API submission
  const extractBaseIdeaFields = (data: IdeaFormData): InsertIdea => {
    return {
      idea: data.idea,
      founderName: data.founderName,
      founderEmail: data.founderEmail,
      companyStage: data.companyStage,
      websiteUrl: data.websiteUrl,
      companyName: data.companyName,
    };
  };
  
  const onSubmit = (values: IdeaFormData) => {
    // Now we send the entire form data including lean canvas
    // The server will handle creating both the idea and lean canvas
    createIdea(values);
    onClose();
    form.reset();
    setCurrentStep(0);
  };
  
  const nextStep = async () => {
    const fieldsToValidate = [
      // Step 1 fields
      ...(currentStep === 0 ? ['idea'] : []),
      // Additional steps don't require validation as they're optional
    ];
    
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };
  
  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };
  
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
        form.reset();
        setCurrentStep(0);
      }
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{steps[currentStep].title}</DialogTitle>
          <DialogDescription>
            {steps[currentStep].description}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step indicators */}
        <div className="flex items-center justify-center mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div 
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                  index < currentStep 
                    ? "bg-blue-500 border-blue-500 text-white" 
                    : index === currentStep 
                    ? "border-blue-500 text-blue-500" 
                    : "border-gray-300 text-gray-300"
                )}
                onClick={() => {
                  // Allow navigating to previous steps or current step
                  if (index <= currentStep) {
                    setCurrentStep(index);
                  }
                }}
                style={{ cursor: index <= currentStep ? 'pointer' : 'default' }}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={cn(
                    "w-12 h-1", 
                    index < currentStep ? "bg-blue-500" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step 1: Basic Idea Information */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idea Title <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Give your idea a clear, memorable title..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Create a concise, descriptive title for your business idea.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="idea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your business idea in detail..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a comprehensive description of your business idea.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {/* Step 2: Company Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name (if established)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="founderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="founderEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founder Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Your email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Stage</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="Concept">Concept</SelectItem>
                            <SelectItem value="Validation">Validation</SelectItem>
                            <SelectItem value="MVP">MVP</SelectItem>
                            <SelectItem value="EarlyStage">Early Stage</SelectItem>
                            <SelectItem value="Growth">Growth</SelectItem>
                            <SelectItem value="Established">Established</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Step 3: Lean Canvas Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="leanCanvas.problem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What key problems does your idea solve?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Identify the top 1-3 problems your customers face that your solution addresses.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="leanCanvas.customerSegments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Segments</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Who are your target customers?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Define your target customers and users. Who will benefit most from your solution?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="leanCanvas.uniqueValueProposition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unique Value Proposition</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What makes your offering unique and valuable?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Clearly state why your solution is different and worth buying.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Step 4: Additional Lean Canvas Fields */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="leanCanvas.solution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Solution</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What are the key features of your solution?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leanCanvas.channels"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channels</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="How will you reach your customers?"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="leanCanvas.keyMetrics"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Metrics</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What key metrics will you track?"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leanCanvas.revenueStreams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Revenue Streams</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="How will you make money?"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="leanCanvas.costStructure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Structure</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What are your main costs?"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="leanCanvas.unfairAdvantage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unfair Advantage</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What's your unfair advantage that can't be easily copied?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any other information about your idea..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              {!isFirstStep && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    onClose();
                    form.reset();
                    setCurrentStep(0);
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                
                {isLastStep ? (
                  <Button type="submit" disabled={isCreating} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {isCreating ? "Submitting..." : "Submit"}
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={nextStep}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
