import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIdeas } from "@/hooks/use-ideas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface NewIdeaModalProps {
  open: boolean;
  onClose: () => void;
}

const ideaFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type IdeaFormData = z.infer<typeof ideaFormSchema>;

export function NewIdeaModal({ open, onClose }: NewIdeaModalProps) {
  const { createIdea, isCreating } = useIdeas();

  const form = useForm<IdeaFormData>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
    mode: "onBlur",
  });

  const onSubmit = (values: IdeaFormData) => {
    createIdea(values);
    onClose();
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
        form.reset();
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Idea</DialogTitle>
          <DialogDescription>
            Provide a title and description for your business idea.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Give your idea a clear, memorable title..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A concise, descriptive title for your business idea.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your business idea in detail..."
                      className="resize-none"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A comprehensive description of your business idea. The more detail, the better the generated documents.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  form.reset();
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
                {isCreating ? "Submitting..." : "Create Idea"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
